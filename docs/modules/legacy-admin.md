# Module: legacy-admin

## Purpose and Responsibilities
Legacy admin API consumed by admin UI for managing listings and vendor profile data.

Primary code:
- `/Users/reipano/Personal/vehicle-api/src/modules/legacy-admin/legacy-admin.controller.ts`
- `/Users/reipano/Personal/vehicle-api/src/modules/legacy-admin/legacy-admin.service.ts`

## Public Surface
Base route: `/admin`
- `GET /posts`
- `GET /posts/:id`
- `DELETE /posts/:id`
- `PATCH /posts/:id/sold`
- `GET /user`
- `POST /user`
- `POST /user/change-password`
- `POST /vendor/contact`
- `POST /vendor/biography`
- `POST /vendor/profile-picture`

Guard:
- `LegacyJwtAdminGuard` at controller level
- `@LegacyUserId()` decorator provides principal id

## Internal Structure
- Controller only coordinates identity and request mapping
- Service owns business operations for admin actions

## End-to-End Flows
1. Admin JWT guard validates token and `ADMIN` role.
2. Controller resolves user id from guard payload decorator.
3. Service performs post/user/vendor update operations.

## State/Data Mutations
- `post`
- `car_detail`
- `search`
- `vendor`
- user profile/password fields

## Env Vars Affecting Module
- `JWT_SECRET`
- `ADMIN_CODE` (guard fallback path in common admin guard for machine flows)

## Error and Edge-Case Behavior
- Unauthorized/non-admin token -> 401
- Missing target resources -> legacy error contracts from service

## Security Controls
- Explicit admin role guard required
- State-changing routes use non-GET verbs

## Observability
- Uses shared structured logging from service/utility layers

## Recent Changes Implemented
- Admin role guard enforced.
- GET mutating routes replaced with `DELETE`/`PATCH`.
- Token extraction centralized via decorator/guard path.

## Known Risks and Limits
- Some downstream clients still expect legacy envelope semantics.

## Ownership and Touchpoints
- Calls into `legacy-group-b` and other shared service paths.

## Failure Mode Example
- **Symptom**: admin UI loads but cannot mutate posts.
- **Why**: token lacks `ADMIN` role claim.
- **Where**: `/Users/reipano/Personal/vehicle-api/src/common/guards/legacy-jwt-admin.guard.ts`.
- **Action**: validate role assignment in role-management endpoints.

## Related Docs
- `modules/legacy-ap.md`
- `RUNBOOKS.md`
