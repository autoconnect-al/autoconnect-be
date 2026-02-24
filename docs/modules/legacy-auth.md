# Module: legacy-auth

## Purpose and Responsibilities
Authentication and account-access endpoints for legacy clients.

Primary code:
- `/Users/reipano/Personal/vehicle-api/src/modules/legacy-auth/legacy-auth.controller.ts`
- `/Users/reipano/Personal/vehicle-api/src/modules/legacy-auth/legacy-auth.service.ts`

## Public Surface
Controller root routes:
- `POST /authentication/login`
- `POST /user/login`
- `POST /user/create-user`
- `GET /user/refresh-token`
- `POST /user/reset-password`
- `POST /user/verify-password`
- `GET /instagram-sync/get-access-token`

Guards:
- `AuthRateLimitGuard` on login/reset/verify routes

## Internal Structure
- Shared login endpoint handler pattern
- Refresh token path using legacy bearer extraction
- Instagram OAuth token exchange path

## End-to-End Flows
1. Login endpoint validates payload and rate limits.
2. Delegates credential validation to `LocalUserVendorService`.
3. Refresh path verifies token and reissues JWT.
4. Password reset flow issues/validates reset codes.
5. Instagram sync exchanges short-lived -> long-lived tokens.

## State/Data Mutations
- user password/reset fields
- possibly vendor/user records through service delegation

## Env Vars Affecting Module
- `JWT_SECRET`
- `INSTAGRAM_CLIENT_ID`
- `INSTAGRAM_CLIENT_SECRET`
- `INSTAGRAM_REDIRECT_URI`

## Error and Edge-Case Behavior
- Invalid auth payload -> 400
- Invalid credentials/token -> 401
- Upstream Instagram failure -> controlled legacy error

## Security Controls
- Rate-limited auth endpoints
- Required envs for OAuth credentials
- No hardcoded OAuth secret fallback

## Observability
- `legacy-auth-service` logs auth path exceptions

## Recent Changes Implemented
- OAuth secrets moved to env-only required config.
- Auth status codes corrected.
- Duplicate login controller logic consolidated.

## Known Risks and Limits
- Legacy envelope compatibility constrains response model modernization.

## Ownership and Touchpoints
- Depends on `legacy-group-a` and common auth utilities.

## Failure Mode Example
- **Symptom**: Instagram sync fails for all users.
- **Why**: missing redirect URI/client secret mismatch.
- **Where**: `/Users/reipano/Personal/vehicle-api/src/modules/legacy-auth/legacy-auth.service.ts` token exchange methods.
- **Action**: verify required Instagram env bundle.

## Related Docs
- `modules/legacy-group-a.md`
- `ENVIRONMENT_VARIABLES.md`
