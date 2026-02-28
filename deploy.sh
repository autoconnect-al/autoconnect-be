#!/usr/bin/env bash
set -euo pipefail

log() {
  echo "==> $*"
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

# Config from env
: "${DEFAULT_BRANCH:=development}"
: "${MODE:=dev}"
: "${RUN_MIGRATIONS:=true}"
: "${USE_PRISMA:=auto}"
: "${BUILD_CMD:=npm run build}"
: "${HEALTHCHECK_URL:=}"

# Required env vars
: "${APP_NAME:?APP_NAME is required (env var)}"
: "${APP_DIR:?APP_DIR is required (env var)}"

BRANCH="${1:-$DEFAULT_BRANCH}"

# Validate config
case "$MODE" in
  dev|prod) ;;
  *) fail "MODE must be 'dev' or 'prod' (got: $MODE)" ;;
esac

case "$USE_PRISMA" in
  auto|true|false) ;;
  *) fail "USE_PRISMA must be one of: auto|true|false (got: $USE_PRISMA)" ;;
esac

case "$RUN_MIGRATIONS" in
  true|false) ;;
  *) fail "RUN_MIGRATIONS must be 'true' or 'false' (got: $RUN_MIGRATIONS)" ;;
esac

log "Starting deploy for app '$APP_NAME'"
log "App dir: $APP_DIR"
log "Branch: $BRANCH"
log "Mode: $MODE"

log "Changing directory to app"
cd "$APP_DIR"

log "Fetching git remotes"
git fetch --all --prune

if ! git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
  log "Remote branch origin/$BRANCH not found locally, fetching explicitly"
  git fetch origin "$BRANCH:$BRANCH" || git fetch origin "$BRANCH" || true
fi

if ! git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null 2>&1; then
  fail "Remote branch origin/$BRANCH does not exist"
fi

log "Checking out branch to match origin/$BRANCH"
git checkout -B "$BRANCH" "origin/$BRANCH"

log "Pulling latest commits (ff-only)"
git pull --ff-only origin "$BRANCH"

log "Installing dependencies (including devDependencies for build)"
export NODE_ENV=development
export NPM_CONFIG_PRODUCTION=false
export npm_config_production=false
export NPM_CONFIG_OMIT=
export npm_config_omit=

if [[ -f package-lock.json ]]; then
  log "Running npm ci --include=dev"
  npm ci --include=dev
else
  log "Running npm install --include=dev"
  npm install --include=dev
fi

PRISMA_ENABLED="false"
if [[ "$USE_PRISMA" == "true" ]]; then
  [[ -f prisma/schema.prisma ]] || fail "USE_PRISMA=true but prisma/schema.prisma not found"
  PRISMA_ENABLED="true"
elif [[ "$USE_PRISMA" == "auto" ]]; then
  if [[ -f prisma/schema.prisma ]]; then
    PRISMA_ENABLED="true"
  fi
fi

if [[ "$PRISMA_ENABLED" == "true" ]]; then
  log "Running Prisma generate"
  npx prisma generate || fail "Prisma generate failed"

  if [[ "$RUN_MIGRATIONS" == "true" ]]; then
    log "Running Prisma migrations (deploy)"
    npx prisma migrate deploy || fail "Prisma migrate deploy failed"
  else
    log "Skipping Prisma migrations (RUN_MIGRATIONS=false)"
  fi
else
  log "Skipping Prisma steps (USE_PRISMA=$USE_PRISMA)"
fi

log "Building application"
bash -lc "$BUILD_CMD"

if [[ "$MODE" == "prod" ]]; then
  log "Pruning devDependencies for production"
  npm prune --omit=dev
else
  log "Skipping prune in dev mode"
fi

log "Restarting PM2 process"
export NODE_ENV=production
pm2 restart "$APP_NAME" --update-env
pm2 save

if [[ -n "$HEALTHCHECK_URL" ]]; then
  log "Running healthcheck: $HEALTHCHECK_URL"
  max_tries=15
  delay=1
  ok=0

  for ((i=1; i<=max_tries; i++)); do
    if curl -fsS "$HEALTHCHECK_URL" >/dev/null; then
      log "Healthcheck passed (attempt $i/$max_tries)"
      ok=1
      break
    fi
    log "Healthcheck failed (attempt $i/$max_tries), retrying in ${delay}s..."
    sleep "$delay"
  done

  if [[ "$ok" -ne 1 ]]; then
    echo "WARNING: Healthcheck failed after $max_tries attempts: $HEALTHCHECK_URL" >&2
    exit 1
  fi
fi

log "Deployment completed successfully for '$APP_NAME' on branch '$BRANCH'"
