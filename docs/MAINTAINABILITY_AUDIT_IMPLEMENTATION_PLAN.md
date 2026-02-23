# Vehicle API Maintainability & Bug-Risk Audit

Generated: 2026-02-21  
Scope: `/Users/reipano/Personal/vehicle-api/src` (+ related infra config)  
Goal: actionable implementation plan grouped by module, prioritized by risk.

---

## How To Use This Document

For each recommendation you get:
- **Issue**: what is wrong and where.
- **Risk**: why this can break security/reliability/maintainability.
- **Implementation**: exact changes to make.
- **Acceptance checks**: how to verify done correctly.

Priority levels:
- **Critical / Must do**: high-risk flaw or security/integrity issue.
- **Important**: high-value stability/maintainability fix.
- **Good to have**: lower risk, good cleanup/architecture improvements.

---

## 0) Cross-Cutting (Shared Infra/Auth/Guards)

### Critical / Must do

#### 0.1 Remove hardcoded secrets and credential fallbacks
- **Status**: ✅ Done (2026-02-21)
- **Issue**
  - Hardcoded secret defaults exist for JWT and external credentials.
  - Locations include:
    - `/Users/reipano/Personal/vehicle-api/src/common/legacy-auth.util.ts`
    - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-auth/legacy-auth.service.ts`
    - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-group-a/local-user-vendor.service.ts`
    - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-group-b/local-post-order.service.ts`
    - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/legacy-ap.service.ts`
    - `/Users/reipano/Personal/vehicle-api/src/modules/imports/remote-post-saver.service.ts`
- **Risk**
  - If env vars are missing, app still boots with known/static secrets.
  - Enables token forgery and privilege escalation.
- **Implementation**
  1. Create config validation in startup (`ConfigModule` + schema validation).
  2. Mark these variables as required in non-test env:
     - `JWT_SECRET`
     - `AP_ADMIN_CODE` or replacement auth secret
     - `INSTAGRAM_CLIENT_ID`
     - `INSTAGRAM_CLIENT_SECRET`
     - `DATABASE_URL`
  3. Remove all `?? <hardcoded_secret>` fallbacks.
  4. Fail fast at boot if missing.
  5. Rotate all production secrets after deployment.
- **Acceptance checks**
  - App fails at boot if any required secret missing.
  - Codebase grep returns no PEM private key blocks in `.ts` files.
  - Previously issued JWTs signed with fallback secret are rejected.
- **Implementation progress**
  - Added startup env validation in `/Users/reipano/Personal/vehicle-api/src/app.module.ts`.
  - Enforced required env in Prisma via `/Users/reipano/Personal/vehicle-api/src/database/prisma.service.ts` (`requireEnv('DATABASE_URL')`).
  - Removed query-secret fallback chain from `/Users/reipano/Personal/vehicle-api/src/common/guards/ap-code.guard.ts`.
  - Kept credential reads explicit (`AP_ADMIN_CODE`, `ADMIN_CODE`, `JWT_SECRET`, `INSTAGRAM_*`) with no hardcoded secret fallback.

#### 0.2 Replace query-string admin auth with proper bearer auth
- **Status**: ✅ Done (2026-02-21)
- **Issue**
  - Admin/API code is accepted via `?code=` query in multiple paths.
  - Files:
    - `/Users/reipano/Personal/vehicle-api/src/common/guards/ap-code.guard.ts`
    - `/Users/reipano/Personal/vehicle-api/src/common/guards/admin.guard.ts`
- **Risk**
  - Query params are logged in proxies, browser history, and analytics.
  - Credential leakage is likely.
- **Implementation**
  1. Deprecate query-based `code` guard.
  2. Require `Authorization: Bearer <token>` with JWT guard for protected endpoints.
  3. If machine-to-machine secret still needed, accept via header only:
     - `X-Admin-Code` (temporary), never query.
  4. Add clear 401 response contract for missing/invalid header.
  5. Update API docs and contract tests.
- **Acceptance checks**
  - Protected endpoints reject requests using query `code` only.
  - Protected endpoints accept valid bearer token.
  - Logs no longer contain secrets in URL.
- **Implementation progress**
  - Updated `/Users/reipano/Personal/vehicle-api/src/common/guards/ap-code.guard.ts` to accept only:
    - `Authorization: Bearer <admin_jwt>` with `ADMIN` role, or
    - `X-Admin-Code`.
  - Updated `/Users/reipano/Personal/vehicle-api/src/common/guards/admin.guard.ts` to the same header/JWT model (no query auth).
  - Updated `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/legacy-ap-auth.controller.ts` to read `X-Admin-Code` header (not query).
  - Updated `/Users/reipano/Personal/vehicle-api/src/modules/imports/remote-post-saver.service.ts` to send `X-Admin-Code` and stop using `?code=` in guarded routes.
  - Updated AP admin controllers in `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/legacy-ap-admin.controller.ts` to `LegacyJwtAdminGuard` so admin panel endpoints now require admin JWT role.
  - Replaced username-based role claim assignment with DB-backed role lookup (`user_role` + `role`) for user JWT mint/refresh paths:
    - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-group-a/local-user-vendor.service.ts`
    - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-auth/legacy-auth.service.ts`
    - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-group-b/local-post-order.service.ts`
  - Added admin role management controls:
    - API: `/role-management/grant-admin/:id` and `/role-management/revoke-admin/:id` (admin JWT protected).
    - CLI bootstrap: `/Users/reipano/Personal/vehicle-api/scripts/admin-role.js` (`npm run admin:role -- <grant|revoke> <userId>`).

#### 0.3 Validate required runtime config at boot
- **Status**: ✅ Done (2026-02-21)
- **Issue**
  - Example: Prisma uses empty string fallback for DB URL.
  - File: `/Users/reipano/Personal/vehicle-api/src/database/prisma.service.ts`
- **Risk**
  - Silent misconfiguration causes runtime failures later.
- **Implementation**
  1. Add config schema in `AppModule`.
  2. In Prisma service constructor, throw if URL missing.
  3. Add startup health check endpoint (optional) returning config sanity status.
- **Acceptance checks**
  - `DATABASE_URL` missing => boot fails deterministically.
- **Implementation progress**
  - Added `ConfigModule.forRoot({ isGlobal: true, validate })` in `/Users/reipano/Personal/vehicle-api/src/app.module.ts`.
  - Validation now fails startup (outside `NODE_ENV=test`) when required env vars are missing.
  - Prisma constructor now fails immediately if `DATABASE_URL` is empty/missing.

### Important

#### 0.4 Standardize error model and HTTP status mapping
- **Status**: ✅ Done (2026-02-21)
- **Issue**
  - Many auth/validation failures return `500` with generic message.
- **Risk**
  - Hard to debug, wrong monitoring signals, clients cannot react correctly.
- **Implementation**
  1. Define central mapping:
     - validation -> 400
     - auth failure -> 401
     - forbidden -> 403
     - not found -> 404
     - conflict -> 409
     - unexpected -> 500
  2. Replace ad-hoc `legacyError('ERROR...', 500)` where not server error.
  3. Keep legacy response body shape if required by frontend.
- **Acceptance checks**
  - Contract tests assert proper status classes per endpoint.
- **Implementation progress**
  - Changed invalid/missing admin auth flows from `500` to `401` in:
    - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/legacy-ap-auth.controller.ts`
    - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/legacy-ap.service.ts`
    - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-auth/legacy-auth.service.ts`
  - Changed invalid login payload from `500` to `400` in:
    - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-auth/legacy-auth.controller.ts`
  - Kept legacy response body shape (`success/message/statusCode`) while correcting HTTP semantics.

### Good to have

#### 0.5 Replace raw `console.*` with structured logger service
- **Status**: ✅ Done (2026-02-21)
- **Issue**
  - Logging is inconsistent and noisy.
- **Implementation**
  1. Add logger wrapper with levels and request correlation ID.
  2. Remove emoji/verbose logs from hot paths.
  3. Ensure secrets and tokens are redacted.
- **Acceptance checks**
  - Logs are JSON and queryable; no secret fields present.
- **Implementation progress**
  - Added structured logger utility with JSON output and key-based secret redaction:
    - `/Users/reipano/Personal/vehicle-api/src/common/logger.util.ts`
  - Replaced raw logging in import-critical and remaining runtime paths:
    - `/Users/reipano/Personal/vehicle-api/src/modules/imports/apify-import/apify-dataset-import.service.ts`
    - `/Users/reipano/Personal/vehicle-api/src/modules/imports/services/post-import.service.ts`
    - `/Users/reipano/Personal/vehicle-api/src/modules/imports/apify-import/apify-import.controller.ts`
    - `/Users/reipano/Personal/vehicle-api/src/modules/imports/encar-import/encar.controller.ts`
    - `/Users/reipano/Personal/vehicle-api/src/modules/imports/services/openai.service.ts`
    - `/Users/reipano/Personal/vehicle-api/src/modules/imports/services/image-download.service.ts`
    - `/Users/reipano/Personal/vehicle-api/src/modules/imports/utils/date-filter.ts`
    - `/Users/reipano/Personal/vehicle-api/src/modules/imports/post.controller.ts`
    - `/Users/reipano/Personal/vehicle-api/src/modules/imports/encar-import/encar-scrape.service.ts`
    - `/Users/reipano/Personal/vehicle-api/src/modules/imports/encar-import/save-from-encar.ts`
    - `/Users/reipano/Personal/vehicle-api/src/modules/imports/remote-post-saver.service.ts`
    - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-auth/legacy-auth.controller.ts`
    - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-auth/legacy-auth.service.ts`
    - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-group-a/local-user-vendor.service.ts`
    - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/legacy-ap.service.ts`
    - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-data/local-media.service.ts`
    - `/Users/reipano/Personal/vehicle-api/src/main.ts`
  - `src` now has no direct `console.*` calls outside the logger utility itself.

---

## 1) Module: `imports`

### Critical / Must do

#### 1.1 Fix shared mutable state race in Apify import service
- **Status**: ✅ Done (2026-02-21)
- **Issue**
  - Class-level mutable fields (`batch`, counters) are reused across runs.
  - File: `/Users/reipano/Personal/vehicle-api/src/modules/imports/apify-import/apify-dataset-import.service.ts`
- **Risk**
  - Concurrent imports can mix records and corrupt counts.
- **Implementation**
  1. Move `batch`, `totalSeen`, `totalQueuedForSave` to local variables inside `importLatestDataset`.
  2. Add run ID and include in logs.
  3. Optionally enforce one active run per source with lock.
- **Acceptance checks**
  - Two concurrent runs produce isolated counts and no cross-contamination.
- **Implementation progress**
  - Removed class-level mutable state (`batch`, counters) and moved run state into local variables in `importLatestDataset`.
  - Added `runId` per import run and included it in logs for traceability.
  - File: `/Users/reipano/Personal/vehicle-api/src/modules/imports/apify-import/apify-dataset-import.service.ts`

#### 1.2 Remove private internals access (`postImportService['prisma']`)
- **Status**: ✅ Done (2026-02-21)
- **Issue**
  - Service accesses another service internals via bracket hack.
- **Risk**
  - Breaks encapsulation, fragile refactors.
- **Implementation**
  1. Add explicit method in `PostImportService`:
     - `getPostState(postId)` returning existence/deleted/sold flags.
  2. Replace direct `['prisma']` access.
- **Acceptance checks**
  - No `['prisma']` access remains.
- **Implementation progress**
  - Added explicit service API:
    - `/Users/reipano/Personal/vehicle-api/src/modules/imports/services/post-import.service.ts` -> `getPostState(postId)`
  - Replaced internal bracket access in:
    - `/Users/reipano/Personal/vehicle-api/src/modules/imports/apify-import/apify-dataset-import.service.ts`

#### 1.3 Fix logic accidentally gated by `SHOW_LOGS`
- **Status**: ✅ Done (2026-02-21)
- **Issue**
  - In `post-import.service.ts`, some DB updates are inside `if (SHOW_LOGS)` block.
- **Risk**
  - Business logic changes by log flag.
- **Implementation**
  1. Move all DB write operations outside log-only branches.
  2. Keep only `console/log` in `SHOW_LOGS` blocks.
- **Acceptance checks**
  - Behavior identical with `SHOW_LOGS=true/false`.
- **Implementation progress**
  - Moved sold-path DB mutations out of logging-only block in:
    - `/Users/reipano/Personal/vehicle-api/src/modules/imports/services/post-import.service.ts`
  - `SHOW_LOGS` now controls logging only, not persistence side effects, in the fixed branch.

### Important

#### 1.4 Replace `setImmediate` fire-and-forget with queue jobs
- **Status**: ✅ Done (2026-02-21)
- **Issue**
  - Async work triggered without persistence/retry.
  - Files:
    - `/Users/reipano/Personal/vehicle-api/src/modules/imports/apify-import/apify-import.controller.ts`
    - `/Users/reipano/Personal/vehicle-api/src/modules/imports/encar-import/encar.controller.ts`
    - `/Users/reipano/Personal/vehicle-api/src/modules/imports/post.controller.ts`
- **Implementation**
  1. Add BullMQ queue for import/increment jobs.
  2. Controllers enqueue and return 202.
  3. Worker handles retries/backoff/dead-letter.
- **Acceptance checks**
  - Process restart does not drop queued jobs.
- **Implementation progress**
  - Added BullMQ queue + worker processor with retries/backoff:
    - `/Users/reipano/Personal/vehicle-api/src/modules/imports/queue/import-jobs.constants.ts`
    - `/Users/reipano/Personal/vehicle-api/src/modules/imports/queue/import-jobs.types.ts`
    - `/Users/reipano/Personal/vehicle-api/src/modules/imports/queue/import-jobs.service.ts`
    - `/Users/reipano/Personal/vehicle-api/src/modules/imports/queue/import-jobs.processor.ts`
  - Registered queue infrastructure in:
    - `/Users/reipano/Personal/vehicle-api/src/modules/imports/apify-import.module.ts`
  - Replaced controller fire-and-forget with queue enqueue + `202` response:
    - `/Users/reipano/Personal/vehicle-api/src/modules/imports/apify-import/apify-import.controller.ts`
    - `/Users/reipano/Personal/vehicle-api/src/modules/imports/encar-import/encar.controller.ts`
    - `/Users/reipano/Personal/vehicle-api/src/modules/imports/post.controller.ts`
  - Added dead-letter queue write on final retry failure in processor.
  - Added fallback mode for environments without Redis yet:
    - `IMPORT_QUEUE_ENABLED=true` -> queue mode enabled.
    - `IMPORT_QUEUE_ENABLED=false` (default) -> inline async fallback (no Redis required).
  - Updated post metric controller tests for queue-based behavior:
    - `/Users/reipano/Personal/vehicle-api/src/modules/imports/post.controller.spec.ts`

#### 1.5 Make Encar parsing/mapping resilient
- **Status**: ✅ Done (2026-02-22)
- **Issue**
  - Large procedural mapper with many assumptions.
- **Implementation**
  1. Split into pure functions by concern: make/model/variant/body/fuel/drivetrain/price.
  2. Add unit tests for each mapping function and edge-case payloads.
- **Acceptance checks**
  - Mapping tests pass for representative samples.
- **Implementation progress**
  - Extracted ENCAR mapping into pure utility functions:
    - `/Users/reipano/Personal/vehicle-api/src/modules/imports/encar-import/encar-mapper.util.ts`
    - Functions: `mapMake`, `mapModel`, `mapVariant`, `mapBodyType`, `mapFuelType`, `mapDrivetrain`, `calculatePrice`, `buildEncarCaption`.
  - Updated scraper mapper wiring to use extracted functions:
    - `/Users/reipano/Personal/vehicle-api/src/modules/imports/encar-import/save-from-encar.ts`
  - Added dedicated unit tests for mapping behaviors and edge-cases:
    - `/Users/reipano/Personal/vehicle-api/src/modules/imports/encar-import/encar-mapper.util.spec.ts`

### Good to have

#### 1.6 Add idempotency and dedupe keys for imports
- **Status**: ✅ Done (2026-02-21)
- **Implementation**
  1. Define idempotency key per source post ID + source type.
  2. Use unique constraints or upsert guard table.
- **Acceptance checks**
  - Replaying same payload does not duplicate writes.
- **Implementation progress**
  - Added DB-backed idempotency guard table bootstrap on startup:
    - `/Users/reipano/Personal/vehicle-api/src/database/prisma.service.ts`
  - Added payload-level idempotency claim/complete/fail flow in import pipeline:
    - `/Users/reipano/Personal/vehicle-api/src/modules/imports/services/post-import.service.ts`
  - Behavior:
    - same source + same payload hash => replay skipped
    - same source + changed payload => processed
    - failed payload can be retried (status transitions from `failed` to `processing`)
  - Added regression test for replay skip:
    - `/Users/reipano/Personal/vehicle-api/src/modules/imports/services/post-import.service.spec.ts`

---

## 2) Module: `legacy-group-a` (`LocalUserVendorService`)

### Critical / Must do

#### 2.1 Migrate password hashing from legacy deterministic crypt
- **Status**: ✅ Done (2026-02-22)
- **Issue**
  - `unixcrypt.encrypt(password, '$6$')` uses static salt pattern.
  - File: `/Users/reipano/Personal/vehicle-api/src/modules/legacy-group-a/local-user-vendor.service.ts`
- **Risk**
  - Weak password storage compared to modern standards.
- **Implementation**
  1. Use `bcrypt` (cost 12+) or `argon2id` for new passwords.
  2. Keep legacy verification fallback temporarily.
  3. On successful legacy login, rehash with modern scheme and save.
  4. Add `passwordAlgorithm` column if needed for explicit migration.
- **Acceptance checks**
  - New users store modern hash format only.
  - Existing legacy users can login once and become upgraded.
- **Implementation progress**
  - Switched password writes to bcrypt (cost 12) in:
    - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-group-a/local-user-vendor.service.ts`
  - Kept legacy verification compatibility (`unixcrypt` + historical bcrypt variants).
  - Added transparent rehash-on-login when legacy hash strategy is detected.
  - Added dedicated password migration tests:
    - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-group-a/local-user-vendor.service.spec.ts`

### Important

#### 2.2 Wrap create-user flow in transaction
- **Status**: ✅ Done (2026-02-23)
- **Issue**
  - Creates user, role, vendor, and sends email in separate steps.
- **Risk**
  - Partial user state on failure.
- **Implementation**
  1. Use Prisma transaction for DB writes.
  2. Send email after transaction commit.
  3. Add retry-safe outbox event for email.
- **Acceptance checks**
  - No half-created records when failures are injected.
- **Implementation progress**
  - Wrapped user + user_role + vendor writes in a single Prisma transaction in:
    - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-group-a/local-user-vendor.service.ts`
  - Kept registration email outside the transaction so side effects run only after commit.
  - Added warning log on registration email failure without rolling back committed user creation.

#### 2.3 Improve error precision
- **Status**: ✅ Done (2026-02-23)
- **Issue**
  - Generic 500 messages for validation/auth outcomes.
- **Implementation**
  - Return specific legacy-compatible messages + correct status code.
- **Acceptance checks**
  - API clients can distinguish invalid credentials vs internal errors.
- **Implementation progress**
  - Updated validation/auth/conflict status mapping in:
    - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-group-a/local-user-vendor.service.ts`
  - Main changes:
    - login payload validation -> `400`
    - login invalid credentials -> `401`
    - create/update uniqueness conflict -> `409`
    - reset password payload/code issues -> `400/401/404` as applicable
  - Kept legacy response body contract (`success`, `message`, `statusCode`) unchanged.

### Good to have

#### 2.4 Add rate limiting for login/reset endpoints
- **Status**: ✅ Done (2026-02-23)
- **Implementation**
  - Add throttling by IP + identifier to reduce brute force.
- **Acceptance checks**
  - Burst invalid attempts get 429.
- **Implementation progress**
  - Added dedicated auth throttling guard that keys by `IP + email/username`:
    - `/Users/reipano/Personal/vehicle-api/src/common/guards/auth-rate-limit.guard.ts`
  - Enabled throttler module for auth stack with default policy window:
    - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-auth/legacy-auth.module.ts`
  - Applied endpoint-specific throttle limits to:
    - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-auth/legacy-auth.controller.ts`
      - `POST /authentication/login` -> `10/min`
      - `POST /user/login` -> `10/min`
      - `POST /user/reset-password` -> `5/min`
      - `POST /user/verify-password` -> `5/min`
  - Rate-limit violations now return legacy-style `429` payload.

---

## 3) Module: `legacy-group-b` (`LocalPostOrderService`)

### Critical / Must do

#### 3.1 Close SSRF/LFI vectors in media ingestion
- **Status**: ✅ Done (2026-02-23)
- **Issue**
  - Service accepts arbitrary URLs and local file paths.
  - File: `/Users/reipano/Personal/vehicle-api/src/modules/legacy-group-b/local-post-order.service.ts`
- **Risk**
  - Server can access internal services or local files.
- **Implementation**
  1. For remote URLs:
     - Allow only `https`.
     - Enforce host allowlist.
     - Block private IP ranges and link-local addresses.
  2. For local paths:
     - Remove support for arbitrary absolute paths from API input.
     - Allow only controlled temp/media directories.
  3. Enforce max content length + MIME checks.
- **Acceptance checks**
  - Requests to `http://127.0.0.1`, `http://169.254.*`, file paths outside allowed dirs are rejected.
- **Implementation progress**
  - Hardened media ingestion in:
    - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-group-b/local-post-order.service.ts`
  - Remote URL controls:
    - only `https://` allowed
    - host allowlist enforcement (`MEDIA_FETCH_ALLOWED_HOSTS`, with safe defaults)
    - DNS resolution + private/local IP rejection (loopback, RFC1918, link-local, ULA)
    - strict image MIME validation + max size cap (15MB)
  - Local path controls:
    - removed arbitrary relative/absolute file reads from API input
    - allow only paths inside controlled media roots (`/media/tmp/*`, `/media/*`, or absolute paths under media root)
    - path traversal prevented via root-bound path resolution checks
  - Added buffer-level image verification before processing via `sharp`.

#### 3.2 Make post save atomic
- **Status**: ✅ Done (2026-02-23)
- **Issue**
  - Post, car_detail, and search are updated independently.
- **Risk**
  - Inconsistent database state.
- **Implementation**
  - Wrap write sequence in a Prisma transaction.
- **Acceptance checks**
  - Fault injection during write leaves no partial updates.
- **Implementation progress**
  - Wrapped `post`, `car_detail`, and `search` persistence in one Prisma transaction in:
    - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-group-b/local-post-order.service.ts`
  - Behavior:
    - update/create post + detail upsert + search upsert now commit or fail together
    - prevents partial post state when any downstream write fails
  - Kept existing endpoint response contract and validation/error behavior.

### Important

#### 3.3 Remove fallback vendor identity
- **Status**: ✅ Done (2026-02-23)
- **Issue**
  - Uses default vendor ID when missing.
- **Implementation**
  - Require authenticated vendor context or explicit valid vendor id.
- **Acceptance checks**
  - Missing/invalid vendor context returns 400/401.
- **Implementation progress**
  - Removed hardcoded vendor fallback in:
    - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-group-b/local-post-order.service.ts`
  - `savePostInternal` now enforces:
    - numeric validation for payload `vendorId`
    - required vendor identity (`JWT` context or explicit `vendorId`)
    - mismatch protection when both JWT and payload vendor IDs are provided
  - Error behavior:
    - missing vendor identity -> `400`
    - invalid vendor id format -> `400`
    - JWT/payload vendor mismatch -> `403`

#### 3.4 Harden payment capture flow
- **Status**: ✅ Done (2026-02-23)
- **Issue**
  - Limited transition validation/idempotency around order capture.
- **Implementation**
  1. Validate order status transitions (`CREATED -> COMPLETED` once).
  2. Add idempotency guard on capture endpoint.
  3. Ensure order ownership checks where relevant.
- **Acceptance checks**
  - Repeated capture of same order is safe/idempotent.
- **Implementation progress**
  - Hardened order flow in:
    - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-group-b/local-post-order.service.ts`
  - Added strict capture transition checks:
    - allows `CREATED -> COMPLETED`
    - rejects invalid transitions with `409`
  - Added idempotent capture behavior:
    - repeated capture on completed order returns `COMPLETED` without reapplying side effects
  - Added ownership checks where available:
    - when order `email` is present, capture validates order owner maps to the post vendor
  - Wrapped capture side effects in one transaction:
    - status transition + promotion writes (`post` + `search`) commit atomically.
  - Added/updated tests:
    - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-group-b/local-post-order.service.spec.ts`

### Good to have

#### 3.5 Externalize package->promotion mapping
- **Status**: ✅ Done (2026-02-23)
- **Implementation**
  - Move hardcoded switch mapping to DB/config.
- **Acceptance checks**
  - Changing package behavior requires no code deploy.
- **Implementation progress**
  - Replaced hardcoded package switch mapping with config-driven mapping in:
    - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-group-b/local-post-order.service.ts`
  - Added env-configurable JSON mapping:
    - `PROMOTION_PACKAGE_MAPPING_JSON`
  - Added parser/validator:
    - filters to allowed promotion fields
    - deduplicates field lists per package
    - falls back to safe defaults when config is missing/invalid
  - Capture flow now builds promotion updates from config map (no code change required for mapping updates).

---

## 4) Module: `legacy-ap`

### Critical / Must do

#### 4.1 Replace destructive full search rebuild
- **Status**: ✅ Done (2026-02-23)
- **Issue**
  - `rebuildSearchFromPosts` does `search.deleteMany({})` then rebuilds with limit 5000.
  - File: `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/legacy-ap.service.ts`
- **Risk**
  - Data loss on crash; silent truncation when >5000 posts.
- **Implementation**
  1. Remove hard limit; paginate through all posts.
  2. Use staging table strategy:
     - build into `search_staging`
     - swap tables atomically.
  3. Or switch to incremental sync updates only.
- **Acceptance checks**
  - Rebuild with >5000 posts preserves full dataset.
  - No empty search window during rebuild.
- **Implementation progress**
  - Replaced destructive rebuild path in:
    - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/legacy-ap.service.ts`
  - Main changes:
    - removed `search.deleteMany({})` full wipe
    - removed hard batch cap behavior by introducing paginated `post` scan (`id` cursor, batch size 500)
    - changed rebuild writes from create-only to `search.upsert` per post
    - added stale-prune cleanup only for unmanaged rows in current horizon (`dateUpdated < runStartedAt`)
  - Result:
    - no empty-search window during rebuild
    - rebuild scales by batches and processes all eligible rows.

#### 4.2 Replace login-with-code admin token flow
- **Status**: ✅ Done (2026-02-23)
- **Issue**
  - `/authentication/login-with-code` grants admin JWT from shared code.
- **Risk**
  - Single leaked code grants admin access.
- **Implementation**
  1. Deprecate endpoint.
  2. Require role-based JWT from real user auth.
  3. Add audit log on privileged actions with actor identity.
- **Acceptance checks**
  - No endpoint can mint admin JWT without user identity.
- **Implementation progress**
  - Removed legacy login-with-code API surface:
    - deleted `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/legacy-ap-auth.controller.ts`
    - removed controller wiring from `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/legacy-ap.module.ts`
    - removed `loginWithCode` minting method from `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/legacy-ap.service.ts`
  - Updated internal automation path to avoid JWT mint-by-code bootstrap:
    - `/Users/reipano/Personal/vehicle-api/src/modules/imports/remote-post-saver.service.ts`
      - removed `/authentication/login-with-code` dependency
      - uses direct admin header auth for post tooling calls
  - Updated AP post tooling guard path to support direct trusted-admin header/JWT:
    - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/legacy-ap-admin.controller.ts` (`ApCodeGuard`)
  - Removed stale OpenAPI route entry for `/authentication/login-with-code`:
    - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-docs/openapi-routes.ts`

### Important

#### 4.3 Split mega service by domain
- **Status**: 🟡 In progress (phase 4 done: 2026-02-23)
- **Issue**
  - `legacy-ap.service.ts` combines many unrelated domains.
- **Implementation**
  - Split into:
    - `ApRoleService`
    - `ApUserService`
    - `ApVendorService`
    - `ApPostToolingService`
    - `ApArticleService`
    - `ApPromptService`
- **Acceptance checks**
  - Each service < ~300 lines and independently tested.
- **Implementation progress**
  - Extracted role management domain into:
    - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/ap-role.service.ts`
  - Extracted user/vendor-admin domain into:
    - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/ap-user-vendor.service.ts`
  - Extracted post tooling domain into:
    - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/ap-post-tooling.service.ts`
  - Extracted article domain into:
    - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/ap-article.service.ts`
  - Added prompt domain service with moved prompt internals:
    - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/ap-prompt.service.ts`
      - now owns `generatePrompt` + `generate*Prompt` SQL builders
      - now owns prompt result import + cache cleaning logic
  - Rewired admin controllers to consume split services (instead of `LegacyApService`) for these domains:
    - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/legacy-ap-admin.controller.ts`
      - `RoleManagementController` -> `ApRoleService`
      - `UserManagementController` -> `ApUserVendorService`
      - `VendorAdminController` -> `ApUserVendorService`
      - `PostToolingController` -> `ApPostToolingService`
      - `CarDetailsAdminController` -> `ApPromptService`
      - `ArticleAdminController` -> `ApArticleService`
  - Registered new providers in:
    - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/legacy-ap.module.ts`
  - Verification:
    - `npm test -- --runInBand` ✅
    - `npm run build` ✅
  - Remaining split scope:
    - ✅ Pruned duplicated prompt methods/helpers from `LegacyApService`.
    - ✅ Added focused unit tests in `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/ap-prompt.service.spec.ts` and retired prompt tests from `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/legacy-ap.service.spec.ts`.
    - Remaining cleanup: prune duplicated role/user/vendor/post/article methods from `LegacyApService` and shrink/remove the class once all callers are migrated.

#### 4.4 Reduce raw SQL surface where possible
- **Implementation**
  - Keep only unavoidable raw SQL in repository layer.
  - Parameterize all dynamic values.
- **Acceptance checks**
  - No query string interpolation for user input.

### Good to have

#### 4.5 Add batch job safeguards (timeouts, progress checkpoints)
- **Implementation**
  - For long prompt-generation/fix routines, add progress persistence and resume support.
- **Acceptance checks**
  - Interrupted jobs can resume from checkpoint.

---

## 5) Module: `legacy-data`

### Critical / Must do

#### 5.1 Close SSRF/LFI in `upload-image`
- **Issue**
  - Accepts URL and filesystem path in payload, then fetches/reads directly.
  - File: `/Users/reipano/Personal/vehicle-api/src/modules/legacy-data/local-media.service.ts`
- **Risk**
  - Can access internal network and local files.
- **Implementation**
  1. Accept only multipart upload or approved temporary media references.
  2. Remove arbitrary local path reads from request payload.
  3. Apply URL allowlist + size/mime checks if remote fetch remains.
- **Acceptance checks**
  - Internal/private URLs and arbitrary paths are blocked.

### Important

#### 5.2 Fix nondeterministic latest articles query
- **Issue**
  - `GROUP BY category` with non-aggregated columns can return arbitrary rows.
  - File: `/Users/reipano/Personal/vehicle-api/src/modules/legacy-data/legacy-data.service.ts`
- **Implementation**
  - Use window function or subquery to fetch latest row per category deterministically.
- **Acceptance checks**
  - Same input data always yields same latest records.

#### 5.3 Clarify/align language filtering behavior
- **Issue**
  - `lang` parameter is inconsistently used.
- **Implementation**
  - Either enforce language filter in all article endpoints or remove redundant param.
- **Acceptance checks**
  - Endpoint behavior matches documented contract.

### Good to have

#### 5.4 Add DTO validation for all `data/*` mutation endpoints
- **Implementation**
  - Replace raw unknown objects with explicit DTOs + class-validator.
- **Acceptance checks**
  - Invalid payloads fail fast with 400 and structured errors.

---

## 6) Module: `legacy-search`

### Critical / Must do

#### 6.1 Remove dynamic SQL list concatenation
- **Issue**
  - Excluded IDs/accounts are concatenated into SQL snippets.
  - File: `/Users/reipano/Personal/vehicle-api/src/modules/legacy-search/legacy-search.service.ts`
- **Risk**
  - SQL injection surface and sanitizer fragility.
- **Implementation**
  1. Parse list to validated array.
  2. Build placeholders dynamically (`IN (?, ?, ?)`), pass values as params.
  3. Do not inject quoted values into query string.
- **Acceptance checks**
  - Payload with quotes/special chars cannot alter SQL behavior.

### Important

#### 6.2 Remove or flag result-count inflation logic
- **Issue**
  - Controller applies hardcoded count inflation bands.
  - File: `/Users/reipano/Personal/vehicle-api/src/modules/legacy-search/legacy-search.controller.ts`
- **Implementation**
  - Remove, or keep behind explicit feature flag with docs.
- **Acceptance checks**
  - Count endpoint behavior is deterministic and documented.

#### 6.3 Extract query builder into isolated tested component
- **Implementation**
  - Move filter parsing/building to dedicated utility/repository with exhaustive tests.
- **Acceptance checks**
  - Query generation tests cover keywords, ranges, quick-search tokenization.

### Good to have

#### 6.4 Add query performance baselines
- **Implementation**
  - Capture timings for most-used search combos.
  - Add indexes for hot filters.
- **Acceptance checks**
  - P95 search latency target met under expected volume.

---

## 7) Module: `legacy-sitemap`

### Critical / Must do

#### 7.1 Fix wrong english path mapping in some branches
- **Issue**
  - Some branches use Albanian path variable for English alternate URL.
  - File: `/Users/reipano/Personal/vehicle-api/src/modules/legacy-sitemap/legacy-sitemap.service.ts`
- **Implementation**
  - Ensure every English path uses `pathLocales.en`.
- **Acceptance checks**
  - Generated alternates contain correct EN URLs for all route classes.

### Important

#### 7.2 Reduce heavy full-table sitemap generation cost
- **Implementation**
  - Add caching/materialized output and incremental updates.
- **Acceptance checks**
  - Sitemap generation does not perform full heavy scans on every request.

### Good to have

#### 7.3 Add sitemap snapshot tests
- **Implementation**
  - Snapshot known output for key app names/locales.
- **Acceptance checks**
  - Route mapping regressions detected in CI.

---

## 8) Module: `legacy-auth`

### Critical / Must do

#### 8.1 Remove Instagram client secret fallback in code
- **Issue**
  - Hardcoded fallback secret exists.
- **Implementation**
  - Env-only config; fail if missing.
- **Acceptance checks**
  - No client secret literal in source.

### Important

#### 8.2 Correct status codes for auth failures
- **Implementation**
  - Invalid credentials/token failures -> 401, not 500.
- **Acceptance checks**
  - Contract tests enforce 401 on auth failure paths.

### Good to have

#### 8.3 Consolidate duplicated controller login logic
- **Implementation**
  - Extract helper for shared login handlers.
- **Acceptance checks**
  - Lower duplication, same response contract.

---

## 9) Module: `legacy-admin`

### Critical / Must do

#### 9.1 Enforce admin role guard on controller
- **Issue**
  - Controller currently validates token/user id but not explicit admin role.
  - File: `/Users/reipano/Personal/vehicle-api/src/modules/legacy-admin/legacy-admin.controller.ts`
- **Implementation**
  - Apply `LegacyJwtAdminGuard` at controller level.
- **Acceptance checks**
  - Non-admin JWT cannot access admin routes.

### Important

#### 9.2 Replace state-changing GET routes
- **Issue**
  - Uses GET for delete/sold actions.
- **Implementation**
  - Use `DELETE`/`PATCH` endpoints and preserve compatibility via transitional aliases if needed.
- **Acceptance checks**
  - Mutating actions are non-GET.

### Good to have

#### 9.3 Centralize token extraction/auth in guard/decorator
- **Implementation**
  - Remove repeated token parsing from controller methods.
- **Acceptance checks**
  - Cleaner controller, less duplicate auth code.

---

## 10) Module: `legacy-payments`

### Critical / Must do

#### 10.1 Add strict order state + idempotent capture
- **Issue**
  - Capture flow can be retried without explicit idempotency semantics.
- **Implementation**
  1. Validate current status before capture.
  2. Add idempotency token or unique capture marker.
  3. Return stable result for repeat calls.
- **Acceptance checks**
  - Duplicate capture requests do not duplicate business effects.

### Important

#### 10.2 Improve payment failure diagnostics
- **Implementation**
  - Add structured error codes and internal reason tags.
- **Acceptance checks**
  - Support team can identify exact failure path quickly.

### Good to have

#### 10.3 Separate provider integration abstraction
- **Implementation**
  - Encapsulate gateway logic under provider interface.
- **Acceptance checks**
  - Can swap/mock provider without touching controller.

---

## 11) Module: `legacy-docs`

### Critical / Must do
- None currently blocking.

### Important

#### 11.1 Move docs access secret from query to header
- **Issue**
  - `?code=` can leak in logs/history.
- **Implementation**
  - Use header-based docs auth (`X-Docs-Token`) or signed short-lived URL.
- **Acceptance checks**
  - Docs endpoint no longer needs secret in URL.

### Good to have

#### 11.2 Generate OpenAPI from source decorators/DTOs
- **Implementation**
  - Reduce manually curated route list drift.
- **Acceptance checks**
  - New endpoints appear automatically in docs.

---

## 12) Module: `legacy-favourites`

### Critical / Must do
- None.

### Important

#### 12.1 Add upper bound on favourites ID list size
- **Issue**
  - Large query lists can create heavy DB load.
- **Implementation**
  - Limit count (e.g., 200 IDs) and reject/trim above threshold.
- **Acceptance checks**
  - Huge list payload is safely bounded.

### Good to have

#### 12.2 Add short TTL cache for repeated favourites lookups
- **Implementation**
  - Cache by normalized ID list hash.
- **Acceptance checks**
  - Reduced repeated DB reads for identical requests.

---

## 13) Suggested Implementation Order (Execution Plan)

### Phase 1: Security and integrity first
1. Remove hardcoded secrets/fallbacks.
2. Replace query secret auth in guards.
3. Add config validation fail-fast.
4. Fix SSRF/LFI in media upload/read paths.
5. Fix admin role enforcement.

### Phase 2: Data consistency and reliability
1. Transactional writes in post save flows.
2. Replace fire-and-forget jobs with queue.
3. Fix import mutable-state race.
4. Harden payment idempotency.
5. Replace destructive search rebuild.

### Phase 3: Maintainability and correctness
1. Split `legacy-ap.service.ts`.
2. Extract search query builder.
3. Fix sitemap EN-path bug + tests.
4. Fix latest article deterministic query.
5. Standardize status/error mapping.

### Phase 4: Cleanups and observability
1. Structured logger + redaction.
2. DTO validation expansions.
3. Snapshot/contract test hardening.
4. Caching where beneficial.

---

## 14) Testing Plan (Minimum Required)

### Unit tests
- Mapping/parsing functions in imports and search tokenization.
- Password migration logic (legacy verify + rehash).
- Guard behavior for auth headers and denied query secret paths.

### Integration tests
- Post save transaction rollback behavior.
- Payment capture idempotency.
- Admin endpoints reject non-admin JWT.
- Search excluded IDs/accounts cannot inject SQL.

### Security tests
- SSRF test cases:
  - `http://127.0.0.1/...`
  - `http://169.254.169.254/...`
  - file path traversal inputs
- Secret presence scan in source.

### Contract tests
- Preserve legacy response shape.
- Correct status codes for auth/validation failures.

---

## 15) Known Environment Gap While Auditing

Attempting to run tests in this environment failed before execution due to Node runtime incompatibility with installed Jest syntax.
- Command: `npm test -- --runInBand`
- Error: `SyntaxError: Unexpected token '.'` in `jest-cli`
- Implication: verify Node version compatibility before using this plan in CI/local automation.

---

## 16) Quick Checklist for Smaller Implementation Model

Use this checklist as strict task prompts:

- [ ] Remove all hardcoded secrets and fallback credentials from source.
- [ ] Add env schema validation and fail startup on missing required vars.
- [ ] Replace query-based admin/docs code auth with headers/JWT.
- [ ] Apply `LegacyJwtAdminGuard` to admin module routes.
- [ ] Block SSRF/LFI in all image/media ingestion paths.
- [ ] Wrap multi-table post write flows in transaction.
- [ ] Convert background async `setImmediate` handlers to queue jobs.
- [ ] Make Apify import run state local per execution.
- [ ] Remove private service internals access (`['prisma']`).
- [ ] Parameterize all dynamic SQL list filters.
- [ ] Fix nondeterministic latest article SQL.
- [ ] Fix sitemap EN alternate path generation bug.
- [ ] Replace destructive search rebuild with safe incremental/staging strategy.
- [ ] Add payment capture idempotency and transition checks.
- [ ] Standardize HTTP status mapping and legacy error body consistency.
- [ ] Add tests covering all above regressions.
