# Behavior Catalog

## Purpose
Symptom-oriented lookup for "what happened", "why", and "who owns it".

## By Symptom

## App does not boot
- Likely owner: Cross-cutting config validation
- Why: required env var missing (`DATABASE_URL`, `JWT_SECRET`, admin/OAuth vars)
- Where: `src/app.module.ts`
- Runbook: `RUNBOOKS.md` -> Boot failures

## Admin endpoints return 401
- Owner: `legacy-admin` + auth guards
- Why: missing `ADMIN` role or invalid/missing bearer token
- Where: `LegacyJwtAdminGuard`, `legacy-admin.controller.ts`
- Runbook: Admin auth failures

## AP tooling endpoints reject requests
- Owner: `legacy-ap`
- Why: wrong bearer role or `X-Admin-Code` mismatch on code-guarded routes
- Where: `legacy-ap-admin.controller.ts`, `ap-code.guard.ts`
- Runbook: AP access failures

## Import job accepted but posts not created
- Owner: `imports`
- Why:
  - duplicate payload idempotency already completed
  - source fetch failure
  - source data filtered (old/sold)
- Where: `post-import.service.ts`, Apify/Encar controller-service chain
- Runbook: Import no-op diagnosis

## Imported post exists but missing car details
- Owner: `imports`
- Why: AI disabled/empty result and fallback empty detail path used
- Where: `PostImportService.importPost`
- Runbook: Import data-quality checks

## Imported post exists but images missing
- Owner: `imports` image path
- Why: image download/transform failure (non-blocking)
- Where: `ImageDownloadService`, `PostImportService` image branch
- Runbook: Import media failures

## Post saved but not visible in search
- Owner: `legacy-ap` search rebuild and `legacy-group-b` write paths
- Why:
  - search rebuild not executed/failed
  - post outside rebuild horizon
  - detail missing/deleted branch skipped
- Where: `ApPostToolingService.rebuildSearchFromPosts`
- Runbook: Search repopulation and rebuild safety

## Search table suddenly emptied
- Owner: `legacy-ap` rebuild cleanup
- Why: historical destructive prune branch or bad prune config
- Where: `ApPostToolingService.rebuildSearchFromPosts`
- Runbook: Recover empty search table

## Post status stuck on TO_BE_PUBLISHED
- Owner: `legacy-ap`
- Why: search upsert did not succeed for that post
- Where: post status transition in rebuild flow
- Runbook: Publish transition verification

## Payment capture conflict
- Owner: `legacy-payments` + `legacy-group-b`
- Why: order state not `CREATED` or duplicate capture key
- Where: `LocalPostOrderService.captureOrder`
- Runbook: Payment capture diagnosis

## Payment capture applied twice concern
- Owner: `legacy-payments` + `legacy-group-b`
- Why/Prevention: idempotency marker + status transition gate
- Where: `customer_orders.captureKey/capturedAt`
- Runbook: Verify capture idempotency

## Docs endpoint always returns not found
- Owner: `legacy-docs`
- Why: wrong/missing `X-Docs-Token` or `DOCS_ACCESS_CODE`
- Where: `legacy-docs.service.ts`
- Runbook: Docs access issues

## Favourites endpoint returns 400
- Owner: `legacy-favourites`
- Why: more than 200 IDs in query list
- Where: `LegacyFavouritesService`
- Runbook: Favourites validation issues

## Sitemap endpoint slow
- Owner: `legacy-sitemap`
- Why: cache misses/restarts/very low TTL
- Where: `LegacySitemapService.getCachedSitemap`
- Runbook: Sitemap performance

## By Module
- `cross-cutting`: boot/auth/cors/logging/env issues
- `imports`: ingestion/idempotency/media/import queue
- `legacy-group-a`: login/user/password reset
- `legacy-group-b`: post writes/order capture/promotion updates
- `legacy-ap`: management tooling/search rebuild/prompt jobs
- `legacy-data`: read API + data mutation API + upload-image
- `legacy-search`: listing query/count/related logic
- `legacy-sitemap`: sitemap generation/cache
- `legacy-auth`: auth endpoints + Instagram OAuth
- `legacy-admin`: admin dashboard operations
- `legacy-payments`: order HTTP API contract
- `legacy-docs`: guarded OpenAPI/doc access
- `legacy-favourites`: favorites filter endpoints

## Related Docs
- `modules/*.md`
- `RUNBOOKS.md`
- `DATA_MODEL_AND_STATE_TRANSITIONS.md`
