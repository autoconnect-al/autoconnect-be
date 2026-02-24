# Implemented Changes by Module

## Purpose
Consolidated ledger of important maintenance/security changes implemented from the audit plan, organized by module.

Use this file for:
- migration/change impact review
- regression triage
- future refactor planning

Primary source plan:
- `/Users/reipano/Personal/vehicle-api/docs/MAINTAINABILITY_AUDIT_IMPLEMENTATION_PLAN.md`

---

## Cross-Cutting (`src/common`, app bootstrap, shared guards)

### Change: Removed hardcoded secrets and weak fallbacks
- Before:
  - Runtime accepted implicit/hardcoded fallback secrets in multiple paths.
- After:
  - Required runtime secrets validated at startup; missing required values fail fast.
- Files:
  - `/Users/reipano/Personal/vehicle-api/src/app.module.ts`
  - `/Users/reipano/Personal/vehicle-api/src/database/prisma.service.ts`
  - `/Users/reipano/Personal/vehicle-api/src/common/legacy-auth.util.ts`
  - `/Users/reipano/Personal/vehicle-api/src/common/guards/ap-code.guard.ts`
- Why better:
  - Prevents booting insecurely with known defaults.
  - Reduces token forgery and privilege escalation risk.

### Change: Query-param admin code auth removed from guard behavior
- Before:
  - `?code=` based auth accepted in admin/internal routes.
- After:
  - Auth requires `Authorization: Bearer <jwt>` (admin role) or `X-Admin-Code` header.
- Files:
  - `/Users/reipano/Personal/vehicle-api/src/common/guards/ap-code.guard.ts`
  - `/Users/reipano/Personal/vehicle-api/src/common/guards/admin.guard.ts`
- Why better:
  - Avoids leaking credentials in URL logs/history/analytics.

### Change: Standardized status mapping for auth/validation failures
- Before:
  - Some client/input failures returned `500`.
- After:
  - Validation -> `400`, auth failure -> `401`, conflicts -> `409` while keeping legacy envelope.
- Files:
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-auth/legacy-auth.controller.ts`
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-auth/legacy-auth.service.ts`
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/*`
- Why better:
  - Better client behavior and observability accuracy.

### Change: Structured logging utility adopted
- Before:
  - Mixed `console.*` patterns and inconsistent context.
- After:
  - Shared logger utility with stable structure and redaction in critical paths.
- Files:
  - `/Users/reipano/Personal/vehicle-api/src/common/logger.util.ts`
  - plus imports/auth/ap/main service/controller callsites
- Why better:
  - Better traceability and safer logs.

---

## Imports (`src/modules/imports`)

### Change: Apify import run state made local/per-execution
- Before:
  - Class-level mutable counters/batch state could leak across concurrent runs.
- After:
  - Local run-scoped state and runId tracing in `importLatestDataset`.
- Files:
  - `/Users/reipano/Personal/vehicle-api/src/modules/imports/apify-import/apify-dataset-import.service.ts`
- Why better:
  - Removes race-driven cross-contamination.

### Change: Encapsulation fix for post state lookup
- Before:
  - `postImportService['prisma']` internal access hack.
- After:
  - Explicit API method (`getPostState`) used by dependent services.
- Files:
  - `/Users/reipano/Personal/vehicle-api/src/modules/imports/services/post-import.service.ts`
  - `/Users/reipano/Personal/vehicle-api/src/modules/imports/apify-import/apify-dataset-import.service.ts`
- Why better:
  - Safer refactors and cleaner dependency contract.

### Change: Logging flag no longer gates business mutations
- Before:
  - Some mutation logic lived under `SHOW_LOGS` branch.
- After:
  - Writes always execute; flag controls logs only.
- Files:
  - `/Users/reipano/Personal/vehicle-api/src/modules/imports/services/post-import.service.ts`
- Why better:
  - Deterministic behavior independent of verbosity.

### Change: Async import triggers moved to queue model (with fallback)
- Before:
  - `setImmediate` fire-and-forget paths could drop work on restart.
- After:
  - BullMQ-backed job enqueue + worker retries/backoff/dead-letter when enabled.
  - Inline fallback path when queue/Redis disabled.
- Files:
  - `/Users/reipano/Personal/vehicle-api/src/modules/imports/queue/import-jobs.constants.ts`
  - `/Users/reipano/Personal/vehicle-api/src/modules/imports/queue/import-jobs.types.ts`
  - `/Users/reipano/Personal/vehicle-api/src/modules/imports/queue/import-jobs.service.ts`
  - `/Users/reipano/Personal/vehicle-api/src/modules/imports/queue/import-jobs.processor.ts`
  - `/Users/reipano/Personal/vehicle-api/src/modules/imports/apify-import/apify-import.controller.ts`
  - `/Users/reipano/Personal/vehicle-api/src/modules/imports/encar-import/encar.controller.ts`
  - `/Users/reipano/Personal/vehicle-api/src/modules/imports/post.controller.ts`
- Why better:
  - Recovery-safe background execution and controlled retry semantics.

### Change: Import idempotency contract added
- Before:
  - Retries/replays could duplicate writes or reprocess unchanged payloads.
- After:
  - claim/complete/fail semantics with replay skip for unchanged payload.
- Files:
  - `/Users/reipano/Personal/vehicle-api/src/modules/imports/services/post-import.service.ts`
  - `/Users/reipano/Personal/vehicle-api/src/database/prisma.service.ts`
- Why better:
  - Idempotent ingest, safer retries, lower duplicate risk.

### Change: ENCAR mapping extracted into pure utilities + tests
- Before:
  - One large procedural mapper with fragile assumptions.
- After:
  - Composable pure mapping functions with edge-case test coverage.
- Files:
  - `/Users/reipano/Personal/vehicle-api/src/modules/imports/encar-import/encar-mapper.util.ts`
  - `/Users/reipano/Personal/vehicle-api/src/modules/imports/encar-import/save-from-encar.ts`
  - `/Users/reipano/Personal/vehicle-api/src/modules/imports/encar-import/encar-mapper.util.spec.ts`
- Why better:
  - Easier maintenance and safer future mapping edits.

---

## Legacy Group A (`src/modules/legacy-group-a`)

### Change: Password strategy upgraded to bcrypt with legacy compatibility
- Before:
  - Deterministic legacy crypt strategy was still used for new writes.
- After:
  - New writes use bcrypt; legacy hashes still verify and auto-upgrade on login.
- Files:
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-group-a/local-user-vendor.service.ts`
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-group-a/local-user-vendor.service.spec.ts`
- Why better:
  - Stronger credential storage without forced account reset.

### Change: Registration write path wrapped in transaction
- Before:
  - User/role/vendor writes could partially persist.
- After:
  - Single transaction for DB entities; email side effect after commit.
- Files:
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-group-a/local-user-vendor.service.ts`
- Why better:
  - Prevents half-created identity state.

### Change: Error precision and auth throttling improved
- Before:
  - Generic 500s and no dedicated login/reset rate limiting.
- After:
  - Correct status model + auth throttling by IP+identifier.
- Files:
  - `/Users/reipano/Personal/vehicle-api/src/common/guards/auth-rate-limit.guard.ts`
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-auth/legacy-auth.module.ts`
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-auth/legacy-auth.controller.ts`
- Why better:
  - Better brute-force resistance and clearer client behavior.

---

## Legacy Group B (`src/modules/legacy-group-b`)

### Change: Media ingestion hardened against SSRF/LFI
- Before:
  - URL/path acceptance had weak restrictions.
- After:
  - HTTPS-only, host allowlist, DNS/IP private-range rejection, safe local path bounds, MIME/size checks.
- Files:
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-group-b/local-post-order.service.ts`
- Why better:
  - Reduces internal network exposure and file traversal risk.

### Change: Post persistence made atomic across related tables
- Before:
  - `post`, `car_detail`, `search` writes could diverge on partial failure.
- After:
  - Transactional write sequence for coherent state.
- Files:
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-group-b/local-post-order.service.ts`
- Why better:
  - Avoids data mismatch and broken listings.

### Change: Vendor identity fallback removed
- Before:
  - Hardcoded/default vendor fallback could write under wrong owner.
- After:
  - Enforced authenticated/explicit vendor identity with mismatch validation.
- Files:
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-group-b/local-post-order.service.ts`
- Why better:
  - Correct ownership guarantees and safer authorization.

### Change: Payment capture transition + idempotency hardened
- Before:
  - Repeated capture could reapply side effects.
- After:
  - Transition guard + idempotent completed behavior + transactional side effects.
- Files:
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-group-b/local-post-order.service.ts`
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-group-b/local-post-order.service.spec.ts`
- Why better:
  - Retry-safe capture API and reduced billing/promote inconsistencies.

### Change: Package->promotion mapping externalized
- Before:
  - Hardcoded switch in code.
- After:
  - Config-driven mapping (`PROMOTION_PACKAGE_MAPPING_JSON`) with safe defaults/validation.
- Files:
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-group-b/local-post-order.service.ts`
- Why better:
  - Mapping updates without deploy and lower code churn.

---

## Legacy AP (`src/modules/legacy-ap`)

### Change: Search rebuild made non-destructive and complete
- Before:
  - Full `search` wipe + capped rebuild (truncation risk and empty-window outage).
- After:
  - Paginated scan with upsert strategy and optional stale prune.
- Files:
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/ap-post-tooling.service.ts`
  - related controller wiring in `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/legacy-ap-admin.controller.ts`
- Why better:
  - No empty search window and no silent cap loss.

### Change: Login-with-code admin JWT minting removed
- Before:
  - Shared code could mint admin token.
- After:
  - Endpoint removed; role-backed JWT/header auth path only.
- Files:
  - removed: `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/legacy-ap-auth.controller.ts`
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/legacy-ap.module.ts`
  - `/Users/reipano/Personal/vehicle-api/src/modules/imports/remote-post-saver.service.ts`
- Why better:
  - Reduces blast radius of leaked shared codes.

### Change: Mega service split into domain services
- Before:
  - One very large service owned unrelated domains.
- After:
  - Domain-specific services with targeted tests and smaller change surface.
- Files:
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/ap-role.service.ts`
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/ap-user-vendor.service.ts`
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/ap-vendor-management.service.ts`
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/ap-post-tooling.service.ts`
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/ap-prompt.service.ts`
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/ap-prompt.repository.ts`
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/ap-article.service.ts`
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/ap-make-model.service.ts`
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/ap-sitemap-admin.service.ts`
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/ap-payment-reminder.service.ts`
- Why better:
  - Lower cognitive load and faster isolated hardening.

### Change: Unsafe dynamic SQL removed from AP services
- Before:
  - `$queryRawUnsafe`/interpolated SQL in multiple domains.
- After:
  - Parameterized `Prisma.sql`/`Prisma.join` patterns and repository isolation.
- Files:
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/ap-role.service.ts`
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/ap-user-vendor.service.ts`
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/ap-post-tooling.service.ts`
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/ap-prompt.service.ts`
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/ap-prompt.repository.ts`
- Why better:
  - Injection-risk reduction and clearer query contracts.

### Change: Long-running prompt imports gained checkpointing
- Before:
  - Interrupted long runs required full restart.
- After:
  - Checkpoint persistence, run IDs, resume-friendly processing.
- Files:
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/ap-prompt.service.ts`
  - `/Users/reipano/Personal/vehicle-api/prisma/schema.prisma`
  - `/Users/reipano/Personal/vehicle-api/prisma/migrations/20260223213000_add_prompt_import_job_checkpoints/migration.sql`
- Why better:
  - Better operational resilience and less repeated work.

---

## Legacy Search (`src/modules/legacy-search`)

### Change: Query handling and behavior parity hardening
- Before:
  - Filter/search behavior risked drift vs expected FE/AP outcomes.
- After:
  - Cleaner query-construction responsibilities and explicit behavior documentation.
- Files:
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-search/*`
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/ap-post-tooling.service.ts`
- Why better:
  - Stable search behavior with easier debugging.

### Change: Post publish/search sync corrections
- Before:
  - Search sync bugs could leave `post.status` stale or over-prune search rows.
- After:
  - Publish transition and prune logic tightened to preserve intended rows.
- Files:
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/ap-post-tooling.service.ts`
- Why better:
  - Prevents empty search table and status mismatch regressions.

---

## Legacy Sitemap (`src/modules/legacy-sitemap`)

### Change: Cache strategy stabilized with TTL + in-flight dedupe
- Before:
  - Redundant generation and burst-load inefficiency.
- After:
  - Keyed cache entries, freshness controls, and concurrent request deduplication.
- Files:
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-sitemap/legacy-sitemap.service.ts`
- Why better:
  - Lower load and faster repeated sitemap responses.

---

## Legacy Auth (`src/modules/legacy-auth`)

### Change: Role assignment corrected to DB-backed role lookup
- Before:
  - Username-based/admin heuristic claims.
- After:
  - JWT role claim sourced from `user_role` + `role` data.
- Files:
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-auth/legacy-auth.service.ts`
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-group-a/local-user-vendor.service.ts`
- Why better:
  - Authorization follows persistent role state, not naming convention.

### Change: Admin role management tooling added
- Before:
  - No explicit maintainable admin grant/revoke flow.
- After:
  - API + CLI role grant/revoke support.
- Files:
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/legacy-ap-admin.controller.ts`
  - `/Users/reipano/Personal/vehicle-api/scripts/admin-role.js`
- Why better:
  - Auditable and reversible admin access control.

---

## Legacy Admin / Docs / Payments / Favourites / Data

### Legacy Admin
- Guard/auth model aligned with header/JWT-only admin flows.
- Files:
  - `/Users/reipano/Personal/vehicle-api/src/common/guards/admin.guard.ts`
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-admin/*`

### Legacy Docs
- Login-with-code route removed from openapi route map.
- Docs endpoint behavior documented and token-gated.
- Files:
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-docs/openapi-routes.ts`
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-docs/*`

### Legacy Payments
- Capture behavior now follows idempotent transactional model from group-b service.
- Files:
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-payments/*`

### Legacy Favourites
- No major architecture refactor in this wave; behavior documented for ownership and failure modes.
- Files:
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-favourites/*`

### Legacy Data
- Media and data write behavior documentation aligned with hardened ingestion/sync paths.
- Files:
  - `/Users/reipano/Personal/vehicle-api/src/modules/legacy-data/*`

---

## Verification Snapshot
- Module coverage docs exist for each requested module under:
  - `/Users/reipano/Personal/vehicle-api/docs/modules/`
- ADR index and initial ADR set exist under:
  - `/Users/reipano/Personal/vehicle-api/docs/adr/`
- Core system docs exist:
  - `/Users/reipano/Personal/vehicle-api/docs/ARCHITECTURE.md`
  - `/Users/reipano/Personal/vehicle-api/docs/ENVIRONMENT_VARIABLES.md`
  - `/Users/reipano/Personal/vehicle-api/docs/BEHAVIOR_CATALOG.md`
  - `/Users/reipano/Personal/vehicle-api/docs/DATA_MODEL_AND_STATE_TRANSITIONS.md`
  - `/Users/reipano/Personal/vehicle-api/docs/RUNBOOKS.md`

## Maintenance Rule
When any behavior, state transition, auth rule, or env-controlled branch changes, update:
1. relevant module doc
2. architecture/behavior/runbook/state docs as needed
3. this file for significant implementation-level changes
4. ADR if the change is architectural
