# Operational Runbooks

## 1) Boot Failures (missing env)
Symptoms:
- App exits during startup with missing env variable error.

Checks:
1. Review required envs in `ENVIRONMENT_VARIABLES.md`.
2. Confirm `NODE_ENV` and actual env injection path.
3. Verify `DATABASE_URL` and JWT/admin/OAuth bundle are present.

Recovery:
1. Fix env values.
2. Restart service.
3. Verify health by hitting a simple public route.

## 2) Admin/Auth Access Failures
Symptoms:
- Admin/AP endpoints return 401.

Checks:
1. Confirm `Authorization: Bearer <jwt>` present.
2. Confirm token contains `ADMIN` in role claims.
3. For code-guarded routes, validate `X-Admin-Code` and env value.

Recovery:
1. Reissue token from login.
2. Grant/revoke role using role-management endpoints if needed.

## 3) Import Issues
Symptoms:
- Import endpoint returns queued/success but no new posts.

Checks:
1. Confirm source fetch (Apify/Encar) success logs.
2. Check idempotency state (`import_idempotency`).
3. Check post filters (old/sold skips).
4. If queue enabled, verify Redis connectivity.

Recovery:
1. Retry with corrected source/config.
2. Reclaim failed idempotency by rerun path.
3. Temporarily run inline mode (`IMPORT_QUEUE_ENABLED=false`) for diagnosis.

## 4) Import Media/Image Missing
Symptoms:
- Post imported but images missing.

Checks:
1. Inspect image download/convert logs.
2. Verify `UPLOAD_DIR` and filesystem permissions.
3. Validate sidecar media URLs in source payload.

Recovery:
1. Fix path permissions.
2. Re-run import with force download options where applicable.

## 5) Search Rebuild and Empty Search Recovery
Symptoms:
- `search` table empty or stale.

Checks:
1. Verify source posts exist for current horizon.
2. Check `SEARCH_REBUILD_HORIZON_DAYS` (default 3650).
3. Ensure `SEARCH_REBUILD_PRUNE_STALE` is not unexpectedly enabled.
4. Review `ap-post-tooling-service` logs (`skip-cleanup`/upsert failures).

Safe Recovery Steps:
1. Set `SEARCH_REBUILD_PRUNE_STALE=false`.
2. Set `SEARCH_REBUILD_HORIZON_DAYS=3650` (or larger if needed).
3. Trigger `movePostsToSearch` via AP tooling route.
4. Validate `search` row count and sample entries.
5. Only re-enable prune once rebuild is known healthy.

## 6) Post Status Transition Not Happening
Symptoms:
- Post remains `TO_BE_PUBLISHED`.

Checks:
1. Confirm corresponding `search.upsert` succeeded.
2. Check rebuild logs for upsert exceptions.

Recovery:
1. Fix source data causing upsert failure.
2. Re-run rebuild.

## 7) Payment Capture Problems
Symptoms:
- Capture returns 409/404/403/502.

Checks:
1. Inspect `customer_orders.status`, `captureKey`, `capturedAt`.
2. Validate order->post relation and owner checks.
3. Inspect payment failure code logs.

Recovery:
1. Retry with consistent idempotency key where appropriate.
2. Resolve ownership/state inconsistencies before retry.

## 8) Docs Access Failures
Symptoms:
- `/docs` or `/openapi.json` returns not found.

Checks:
1. Ensure `DOCS_ACCESS_CODE` configured.
2. Send `X-Docs-Token` header matching configured value.

Recovery:
1. Correct env/header and retry.

## 9) Migration Failures
Symptoms:
- Prisma migration errors (P3018/P3009/SQL syntax/table/column mismatch).

Checks:
1. Inspect failing migration SQL query index.
2. Validate target DB schema version and drift.
3. Use `prisma migrate resolve` only with explicit state understanding.

Recovery:
1. Patch migration SQL for target MySQL compatibility.
2. Resolve failed migration state.
3. Re-deploy migrations in order.

## 10) Favourites Endpoint Errors
Symptoms:
- `/favourites/*` returns 400.

Checks:
1. Count ID list length in request.
2. Verify IDs are numeric CSV.

Recovery:
1. Cap list at 200 IDs.
2. Retry with normalized CSV.

## Related Docs
- `BEHAVIOR_CATALOG.md`
- `ENVIRONMENT_VARIABLES.md`
- `modules/*.md`
