# Module: legacy-ap

## Purpose and Responsibilities
Internal/admin power-tooling module for operational management, prompts, roles, user/vendor administration, article/sitemap tasks, and search rebuild orchestration.

Primary code:
- `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/legacy-ap.module.ts`
- `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/legacy-ap-admin.controller.ts`
- `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/ap-*.service.ts`

## Public Surface
High-impact route groups:
- `/role-management/*`
- `/user-management/*`
- `/vendor/*`
- `/vendor-management/*`
- `/post/*`
- `/car-details/*` (AP tooling side)
- `/make-model-data/*`
- `/article/*`
- `/sitemap/generate`
- `/api/v1/orders/send-remind-emails`

Guards in use:
- `LegacyJwtAdminGuard`
- `LegacyJwtGuard`
- `ApCodeGuard`

## Internal Structure
Service split (post-mega-service refactor):
- `ApPostToolingService`
- `ApPromptService`
- `ApArticleService`
- `ApRoleService`
- `ApUserVendorService`
- `ApVendorManagementService`
- `ApMakeModelService`
- `ApSitemapAdminService`
- `ApPaymentReminderService`

## End-to-End Flows
1. Admin/internal caller hits AP route.
2. Guard enforces JWT role or admin code depending on controller.
3. Controller delegates to domain service.
4. Service applies DB updates and optional downstream/cache operations.

## State/Data Mutations
Broadest mutation surface in app:
- `post`, `car_detail`, `search`
- `user`, `vendor`, `role` relations
- `article`
- `import_status`, prompt import job state

## Env Vars Affecting Module
- `AP_ADMIN_CODE`
- `BASE_URL`
- `NEXTJS_CACHE_API_KEY`, `NEXT_CACHE_API_KEY`, `CACHE_API_KEY`
- `RESEND_API_KEY`
- `SEARCH_REBUILD_HORIZON_DAYS`, `SEARCH_REBUILD_PRUNE_STALE`

## Error and Edge-Case Behavior
- Unauthorized access blocked at guard boundaries.
- Prompt import has timeout/checkpoint safeguards.
- Search rebuild now avoids destructive prune by default and skips cleanup when no upserts.

## Security Controls
- Role-based guard on admin-critical AP groups.
- Header-based code auth for AP tooling code-guarded routes.
- Search rebuild pruning gated by explicit env flag.

## Observability
- `ap-post-tooling-service` logs rebuild failures and safety-branch logs.
- Prompt import job progress/checkpoint logs.

## Recent Changes Implemented
- Legacy mega service fully split by domain.
- Safer incremental search rebuild strategy.
- Login-with-code replacement with proper auth path.
- Post status publish transition on successful search upsert.
- Search rebuild safety hardening to prevent empty-table cleanup.

## Known Risks and Limits
- Very large route surface; requires strict change discipline and docs updates.
- Some AP endpoints still use code guard for compatibility.

## Ownership and Touchpoints
- Touches almost every core table and multiple modules (`legacy-group-a`, `legacy-group-b`, `legacy-data`, `legacy-sitemap`).

## Failure Mode Example
- **Symptom**: running update-search leaves `search` empty.
- **Why**: historical destructive cleanup branch or no source rows in horizon.
- **Where**: `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/ap-post-tooling.service.ts` (`rebuildSearchFromPosts`).
- **Action**: use runbook; verify horizon/prune envs and rerun safe rebuild.

## Related Docs
- `RUNBOOKS.md`
- `DATA_MODEL_AND_STATE_TRANSITIONS.md`
- `IMPLEMENTED_CHANGES_BY_MODULE.md`
