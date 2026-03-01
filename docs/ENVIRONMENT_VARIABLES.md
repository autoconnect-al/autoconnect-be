# Environment Variables Reference

## Scope
This file documents env vars used by runtime code in `src/` and their behavior impact.

Secret values are intentionally omitted.

## Required At Boot (non-test)
Validated by `src/app.module.ts`:
- `DATABASE_URL`
- `JWT_SECRET`
- `AP_ADMIN_CODE`
- `ADMIN_CODE`
- `INSTAGRAM_CLIENT_ID`
- `INSTAGRAM_CLIENT_SECRET`
- `INSTAGRAM_REDIRECT_URI`
- `PAYPAL_CLIENT_ID` (unless `PAYMENT_PROVIDER_MODE=local`)
- `PAYPAL_CLIENT_SECRET` (unless `PAYMENT_PROVIDER_MODE=local`)

## Variable Catalog

| Variable | Required | Default / Behavior | Modules / Areas | Sensitivity | Risk if Wrong |
|---|---|---|---|---|---|
| `DATABASE_URL` | Yes (non-test) | No fallback in Prisma service. Boot fails if missing. | `database`, all modules | High | App cannot start / DB not reachable |
| `JWT_SECRET` | Yes (non-test) | Required by JWT encode/verify paths. | `legacy-auth`, `legacy-group-a`, `legacy-group-b`, guards/util | High | Auth bypass or token invalidation |
| `AP_ADMIN_CODE` | Yes (non-test) | Header code accepted in AP guard; no query fallback. | `common/guards/ap-code.guard.ts`, AP tooling | High | AP admin access denied or exposed if weak |
| `ADMIN_CODE` | Yes (non-test) | Header code accepted in admin guard for machine/legacy paths. | `common/guards/admin.guard.ts` | High | Admin access denied or exposed if weak |
| `INSTAGRAM_CLIENT_ID` | Yes (non-test) | Required for IG OAuth token exchange. | `legacy-auth` | High | Instagram auth flow breaks |
| `INSTAGRAM_CLIENT_SECRET` | Yes (non-test) | Required for IG OAuth token exchange. | `legacy-auth` | High | Instagram auth flow breaks |
| `INSTAGRAM_REDIRECT_URI` | Yes (non-test) | Required for IG OAuth token exchange. | `legacy-auth` | Medium | OAuth redirect mismatch / auth failure |
| `PAYPAL_CLIENT_ID` | Yes (non-test, unless local provider mode) | Used to mint OAuth token for PayPal Orders API. | `legacy-payments` | High | Order create/capture fails |
| `PAYPAL_CLIENT_SECRET` | Yes (non-test, unless local provider mode) | Used to mint OAuth token for PayPal Orders API. | `legacy-payments` | High | Order create/capture fails |
| `PAYPAL_ENV` | No | `sandbox` by default; use `live` for production PayPal endpoint. | `legacy-payments` | High | Orders sent to wrong PayPal environment |
| `PAYPAL_BASE_URL` | No | Optional explicit PayPal API base URL override. | `legacy-payments` | Medium | Requests target wrong host if misconfigured |
| `PAYPAL_CURRENCY_CODE` | No | Default `EUR` for PayPal purchase unit currency. | `legacy-group-b`, `legacy-payments` | Medium | Wrong currency in checkout/capture flow |
| `PAYPAL_WEBHOOK_ID` | No (required for webhook signature verification) | Used by PayPal signature verification endpoint. | `legacy-payments` | High | Webhook events cannot be trusted |
| `PAYPAL_HTTP_TIMEOUT_MS` | No | Default `10000` ms timeout for outbound PayPal requests. | `legacy-payments` | Medium | Slow requests can hang longer than expected |
| `PAYPAL_HTTP_RETRY_MAX` | No | Default `2` retries for retryable PayPal failures. | `legacy-payments` | Medium | Reduced resilience or excessive retries |
| `PAYPAL_HTTP_RETRY_BASE_MS` | No | Default `300` ms base backoff between retries. | `legacy-payments` | Low | Retry backoff too short/long |
| `PAYMENT_PROVIDER_MODE` | No | Auto-selects PayPal by default; set `local` to force mock provider. | `legacy-payments` | Medium | Unexpected gateway behavior |
| `PORT` | No | Default `3000`. | app bootstrap | Low | Service binds wrong port |
| `CORS_ORIGINS` | No | Comma list merged with defaults in `main.ts`. | app bootstrap / web clients | Medium | Browser calls blocked or over-opened CORS |
| `CORS_STRICT` | No | `true` enables allowlist callback; else permissive `origin: true`. | app bootstrap | Medium | Cross-origin access too strict or too loose |
| `MEDIA_ROOT` | No | Used by media static mount + local media storage root. | `main.ts`, media utilities, upload paths | Medium | Missing files / wrong media paths |
| `DOTENV_CONFIG_PATH` | No | Optional explicit env file path in `require-env.util.ts`. | cross-cutting env loading | Low | Wrong env file loaded |
| `DOCS_ACCESS_CODE` | No (but required to access docs) | Expected token for `X-Docs-Token` docs access. | `legacy-docs` | Medium | OpenAPI docs inaccessible or exposed |
| `BASE_URL` | No | Default `http://localhost:3000` in sitemap/prompt tooling base URL usage. | `legacy-sitemap`, `legacy-ap/ap-prompt.service.ts` | Low | Wrong URL generation |
| `SITEMAP_CACHE_TTL_SECONDS` | No | Default `300` sec. Controls sitemap cache TTL. | `legacy-sitemap` | Low | Stale sitemap too long / frequent rebuild |
| `SEARCH_REBUILD_HORIZON_DAYS` | No | Default `3650`. Search rebuild source window. | `legacy-ap/ap-post-tooling.service.ts` | Medium | Missing older posts in rebuild if too small |
| `SEARCH_REBUILD_PRUNE_STALE` | No | Default disabled. Only `true` enables stale `search` prune phase. | `legacy-ap/ap-post-tooling.service.ts` | High | Risky prune behavior if misused |
| `SHOW_LOGS` | No | Enables verbose conditional logs in import/image paths. | `imports/*`, some services | Low | Low visibility when off / noisy logs when on |
| `UPLOAD_DIR` | No | Default `./tmp/uploads` for import image handling. | `imports/services/post-import.service.ts`, `image-download.service.ts` | Medium | File write/read failures |
| `OPENAI_API_KEY` | No | Needed when AI detail generation is used. | `imports/services/openai.service.ts` | High | AI calls fail |
| `OPENAI_MODEL` | No | Default `gpt-4o-mini`. | `imports/services/openai.service.ts` | Low | Unexpected model behavior/cost |
| `APIFY_DATASET_URL` | No | Overrides constructed Apify URL. | `imports/apify-import/apify-dataset-import.service.ts` | Medium | Imports pull wrong dataset |
| `APIFY_API_TOKEN` | No (required if dataset URL not overridden) | Used to construct default Apify dataset URL. | `imports/apify-import/apify-dataset-import.service.ts` | High | Apify import fails |
| `IMPORT_QUEUE_ENABLED` | No | `true` enables BullMQ queue mode; otherwise inline fallback. | `imports/apify-import.module.ts` | Medium | Background behavior differs |
| `REDIS_HOST` | No | Default `127.0.0.1` when queue mode enabled. | BullMQ config | Medium | Queue worker not operational |
| `REDIS_PORT` | No | Default `6379` when queue mode enabled. | BullMQ config | Medium | Queue worker not operational |
| `REDIS_PASSWORD` | No | Optional Redis password. | BullMQ config | High | Cannot connect to protected Redis |
| `REDIS_DB` | No | Default `0` Redis DB index. | BullMQ config | Low | Jobs on wrong Redis DB |
| `AUTOCONNECT_BASE_URL` | Yes for remote post saver path (runtime require) | Base URL for remote AP save integration. | `imports/remote-post-saver.service.ts` | Medium | Remote save path broken |
| `AUTOCONNECT_CODE` | Yes for remote post saver path (runtime require) | Admin code header for remote AP integration. | `imports/remote-post-saver.service.ts` | High | Unauthorized remote writes |
| `AP_BASE_URL` | No | Default legacy AP base URL in proxy util. | `common/ap-proxy.util.ts` | Medium | Proxy routes hit wrong backend |
| `HTTP_DEV_MODE` | No | Forwarded to AP proxy header. | `common/ap-proxy.util.ts` | Low | Debug/behavior mismatch |
| `RESEND_API_KEY` | No (required for mail operations) | Used for email send flows. | `legacy-group-a`, `legacy-ap/ap-payment-reminder.service.ts` | High | Password reset/reminder mail failure |
| `MEDIA_FETCH_ALLOWED_HOSTS` | No | Comma-separated allowlist for remote media fetch. Built-in default list exists. | `legacy-group-b/local-post-order.service.ts` | High | SSRF protection too strict/loose |
| `PROMOTION_PACKAGE_MAPPING_JSON` | No | Optional JSON mapping package IDs -> promotion fields. Built-in defaults exist. | `legacy-group-b/local-post-order.service.ts` | Medium | Wrong promotion effects on capture |
| `NEXTJS_CACHE_API_KEY` | No | Cache API key lookup chain for AP prompt actions. | `legacy-ap/ap-prompt.service.ts` | Medium | Prompt import cache calls unauthorized |
| `NEXT_CACHE_API_KEY` | No | Fallback in same key chain. | `legacy-ap/ap-prompt.service.ts` | Medium | Same as above |
| `CACHE_API_KEY` | No | Fallback in same key chain. | `legacy-ap/ap-prompt.service.ts` | Medium | Same as above |

## Personalization Tuning Variables
- `PERSONALIZATION_ENABLED`: master enable flag (`true`/`false`).
- `PERSONALIZATION_RETENTION_DAYS`: inactive profile retention window (default `90`).
- `PERSONALIZATION_MAX_PERSONALIZED_SHARE`: max personalized share per page (default `0.6`).
- `PERSONALIZATION_MODEL_MAX_SHARE`: max model share per page (default `0.25`).
- `PERSONALIZATION_MAKE_MAX_SHARE`: max make share per page (default `0.4`).
- `PERSONALIZATION_MODEL_OPEN_THRESHOLD`: model activation threshold from opens (default `3`).
- `PERSONALIZATION_MAKE_OPEN_THRESHOLD`: make activation threshold from opens (default `2`).
- `PERSONALIZATION_BODYTYPE_OPEN_THRESHOLD`: body type activation threshold from opens (default `2`).
- `PERSONALIZATION_GENERIC_OPEN_THRESHOLD`: open threshold for `fuelType`, `transmission`, `type` (default `3`).
- `PERSONALIZATION_CONTACT_THRESHOLD`: contact activation threshold (default `1`).
- `PERSONALIZATION_SEARCH_CANDIDATE_MULTIPLIER`: default-feed candidate expansion multiplier (default `5`).
- `PERSONALIZATION_SEARCH_CANDIDATE_MAX`: max default-feed candidates fetched for composition (default `500`).
- `PERSONALIZATION_MOST_WANTED_CANDIDATES`: most-wanted candidate pool size before composition (default `24`).

## Present in `.env` but not used directly by `src/` runtime code
These may exist for local tooling or historical reasons:
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `JWT_EXPIRES_IN`
- `MAX_LOGIN_ATTEMPTS`
- `FRONTEND_URL`

## Feature-Critical Bundles

### Authentication bundle
- `JWT_SECRET`, `ADMIN_CODE`, `AP_ADMIN_CODE`

### Instagram OAuth bundle
- `INSTAGRAM_CLIENT_ID`, `INSTAGRAM_CLIENT_SECRET`, `INSTAGRAM_REDIRECT_URI`

### Queue bundle
- `IMPORT_QUEUE_ENABLED`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB`

### Payments bundle
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`
- Optional: `PAYPAL_ENV` (`sandbox` or `live`), `PAYPAL_BASE_URL`, `PAYPAL_CURRENCY_CODE`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_HTTP_TIMEOUT_MS`, `PAYPAL_HTTP_RETRY_MAX`, `PAYPAL_HTTP_RETRY_BASE_MS`, `PAYMENT_PROVIDER_MODE`

### Import external services bundle
- `APIFY_DATASET_URL` or `APIFY_API_TOKEN`
- `OPENAI_API_KEY`, `OPENAI_MODEL`
- `AUTOCONNECT_BASE_URL`, `AUTOCONNECT_CODE`

### Search/sitemap maintenance bundle
- `SEARCH_REBUILD_HORIZON_DAYS`, `SEARCH_REBUILD_PRUNE_STALE`, `SITEMAP_CACHE_TTL_SECONDS`

## Related Docs
- `ARCHITECTURE.md`
- `modules/cross-cutting.md`
- `modules/imports.md`
- `modules/legacy-ap.md`
- `modules/legacy-group-b.md`
- `modules/legacy-sitemap.md`
