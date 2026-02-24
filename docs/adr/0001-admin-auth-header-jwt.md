# ADR 0001: Admin Auth via Header/JWT (No Query-Param Secrets)

- Status: `Accepted`
- Date: `2026-02-21`
- Owners: `legacy-auth`, `legacy-admin`, `legacy-ap`, `imports`

## Context
Admin and internal endpoints accepted shared secrets from query strings (`?code=`). Query params leak through proxies, browser history, analytics, and logs.

## Decision
1. Remove query-string credential acceptance from guards.
2. Use either:
- `Authorization: Bearer <JWT>` with admin role, or
- temporary `X-Admin-Code` header for machine paths.
3. Protect AP admin panel endpoints with `LegacyJwtAdminGuard`.

## Implementation References
- `/Users/reipano/Personal/vehicle-api/src/common/guards/ap-code.guard.ts`
- `/Users/reipano/Personal/vehicle-api/src/common/guards/admin.guard.ts`
- `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/legacy-ap-admin.controller.ts`
- `/Users/reipano/Personal/vehicle-api/src/modules/imports/remote-post-saver.service.ts`

## Consequences
- Better secret hygiene and reduced credential leakage risk.
- AP/UI and automation callers must send headers.
- Transitional compatibility remains through `X-Admin-Code` while JWT-only adoption completes.

## Related Docs
- `/Users/reipano/Personal/vehicle-api/docs/ARCHITECTURE.md`
- `/Users/reipano/Personal/vehicle-api/docs/modules/cross-cutting.md`
