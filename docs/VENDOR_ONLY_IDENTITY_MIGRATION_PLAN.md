# Full `user` Entity Retirement Plan (Vendor-Only Identity)

## Summary
Rewire the backend so **all auth, role, admin, and profile logic runs only on `vendor` + `vendor_role`**, with zero runtime dependency on `user` or `user_role`.  
Keep existing API routes/payload keys for compatibility (`user` naming outward, `vendor` internally).  
Execute as **two-release cutover** (recommended for safe rollback), then drop old tables.

## Goals
- Remove duplicated identity source (`user`).
- Preserve current feature behavior and contracts.
- Keep admin-role authorization intact.
- Keep AP/admin panel login and guards functioning without frontend break.

## Non-Goals
- Renaming public routes from `/user/*` to `/vendor/*` in this initiative.
- Reworking unrelated modules (search/sitemap/payments internals) beyond identity touchpoints.

## Target Data Model

### 1) `vendor` becomes auth principal
Add auth fields to `vendor` (if missing):
- `name` `varchar(255)` not null
- `username` `varchar(255)` not null unique
- `email` `varchar(255)` not null unique
- `password` `text` not null
- `blocked` `boolean` not null default false
- `attemptedLogin` `int` not null default 0
- `verified` `boolean` nullable/default true
- `verificationCode` `varchar(255)` nullable
- `profileImage` `longtext` nullable
- `authDateCreated` `datetime(0)` not null
- `authDateUpdated` `datetime(0)` nullable

### 2) New role link table: `vendor_role`
- `vendor_id` `bigint unsigned` not null
- `role_id` `int` not null
- PK `(vendor_id, role_id)`
- index on `role_id`
- FK to `vendor.id` and `role.id`

### 3) `role` table remains unchanged
### 4) `user` and `user_role` become deprecated, then dropped

## Public API / Contract Strategy
- Keep current endpoints (`/user/login`, `/user/reset-password`, `/admin/user`, etc.).
- Keep legacy response shape (`success`, `message`, `statusCode`).
- Keep JWT claim key `userId` for compatibility, but value is `vendor.id`.
- Keep incoming body keys like `user` accepted; map to vendor-backed service internally.

## Implementation Plan

## Phase 1: Schema + Backfill (Release 1, part A)
1. Add new vendor auth columns and `vendor_role` in Prisma migration.
2. Backfill `vendor` auth fields from `user` where IDs match.
3. Backfill `vendor_role` from `user_role`.
4. Enforce uniqueness on `vendor.username` and `vendor.email`.
5. Produce migration audit report for:
- user rows without vendor
- duplicate usernames/emails
- orphan role links

## Phase 2: Service Rewire to Vendor-Only (Release 1, part B)
1. Replace direct `prisma.user.*` reads/writes with `prisma.vendor.*` in:
- `/Users/reipano/Personal/vehicle-api/src/modules/legacy-group-a/local-user-vendor.service.ts`
- `/Users/reipano/Personal/vehicle-api/src/modules/legacy-auth/legacy-auth.service.ts`
- `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/legacy-ap.service.ts`
2. Replace role lookup utility:
- deprecate `/Users/reipano/Personal/vehicle-api/src/common/user-roles.util.ts`
- add `vendor`-based equivalent and update all call sites.
3. Rewrite admin role grant/revoke SQL from `user_role` to `vendor_role` in:
- `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/legacy-ap.service.ts`
- `/Users/reipano/Personal/vehicle-api/scripts/admin-role.js`
4. Keep method names and controller contracts unchanged so clients continue working.

## Phase 3: Controller Compatibility Layer (Release 1, part C)
1. Continue accepting legacy payload wrappers (`{ user: ... }`) and map to vendor fields.
2. Continue returning legacy-shaped payloads, sourced from vendor auth data.
3. Ensure `LegacyJwtAdminGuard` and admin checks consume vendor-derived role arrays.

## Phase 4: Verification Window (between releases)
1. Run full suite (`npm test` + `npm run test:int`).
2. Validate in staging/production:
- login/refresh/reset
- admin panel access (ADMIN vs non-ADMIN)
- role grant/revoke
- create/update/change password
3. Monitor for any query against `user`/`user_role` (instrumented logs or SQL audit).

## Phase 5: Drop Legacy Tables (Release 2)
1. Remove remaining code references to `user`/`user_role`.
2. DB migration:
- drop `user_role`
- drop `user`
3. Regenerate Prisma client and update schema snapshots/docs.
4. Remove obsolete helper names/docs referencing user-backed storage.

## File-Level Change Map
- `/Users/reipano/Personal/vehicle-api/prisma/schema.prisma`
- `/Users/reipano/Personal/vehicle-api/prisma/migrations/<timestamp>_vendor_identity_rewire/migration.sql`
- `/Users/reipano/Personal/vehicle-api/src/modules/legacy-group-a/local-user-vendor.service.ts`
- `/Users/reipano/Personal/vehicle-api/src/modules/legacy-auth/legacy-auth.service.ts`
- `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/legacy-ap.service.ts`
- `/Users/reipano/Personal/vehicle-api/src/common/user-roles.util.ts` (replace usages)
- `/Users/reipano/Personal/vehicle-api/src/common/vendor-roles.util.ts` (new)
- `/Users/reipano/Personal/vehicle-api/scripts/admin-role.js`
- `/Users/reipano/Personal/vehicle-api/src/modules/legacy-docs/openapi-routes.ts` (wording updates)

## Test Cases and Scenarios

### Unit
1. Login validates vendor password and returns JWT with vendor roles.
2. Reset/verify password updates vendor verification fields.
3. Role resolver returns roles from `vendor_role`.
4. Grant/revoke admin affects `vendor_role` and preserves “cannot revoke last admin”.

### Integration
1. `/authentication/login` and `/user/login` still work with existing request shape.
2. `/user/refresh-token` works with vendor identity.
3. Admin endpoints protected correctly by ADMIN role.
4. `/admin/user` payload still matches expected fields, now sourced from vendor.

### Migration
1. Backfill idempotency (safe on rerun).
2. Duplicate identity conflict handling deterministic.
3. No runtime query touches dropped tables post-Release 2.

## Rollout and Monitoring
- Deploy Release 1 with rewired code and old tables retained.
- Monitor auth error rates, role resolution failures, and admin authorization failures.
- After stable window, deploy Release 2 dropping old tables.
- Keep DB backup before drop migration.

## Risks and Mitigations
- Risk: hidden raw SQL still hitting `user_role`.
- Mitigation: repo grep + query audit before drop.
- Risk: username/email uniqueness collisions on vendor backfill.
- Mitigation: pre-migration conflict report + manual resolution list.
- Risk: client break from naming mismatch.
- Mitigation: preserve legacy external keys/routes until separate contract versioning effort.

## Assumptions and Defaults
- Preferred execution mode: two-release cutover.
- External contracts keep legacy `user` naming for now.
- `vendor.id` is canonical principal ID everywhere.
- Multi-role remains required; `vendor_role` is authoritative.
