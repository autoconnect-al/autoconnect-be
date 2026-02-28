# Module: Cross-Cutting Infrastructure

## Purpose and Responsibilities
This area provides shared runtime behavior used by all modules:
- environment loading/validation
- DB client lifecycle
- request logging
- auth parsing/guards/decorators
- media path resolution
- response envelope helpers

Primary code:
- `/Users/reipano/Personal/vehicle-api/src/app.module.ts`
- `/Users/reipano/Personal/vehicle-api/src/main.ts`
- `/Users/reipano/Personal/vehicle-api/src/database/prisma.service.ts`
- `/Users/reipano/Personal/vehicle-api/src/common/*`

## Public Surface
- App bootstrap configuration (`ConfigModule`, global pipes, CORS)
- Global HTTP access logger
- Common guards:
  - `AdminGuard`
  - `ApCodeGuard`
  - `LegacyJwtGuard`
  - `LegacyJwtAdminGuard`
  - `AuthRateLimitGuard`
- Decorators:
  - `@LegacyUserId()`
  - `@LegacyJwtEmail()`
- Legacy auth/token utilities

## Internal Structure
- `logger.util.ts`: structured JSON logging + redaction
- `require-env.util.ts`: explicit env fetch with fail-fast semantics
- `media-path.util.ts`: canonical media root resolver
- `legacy-response.ts`: response envelope helper (`legacySuccess`, `legacyError`)

## End-to-End Flows
1. App starts -> env validation in `app.module.ts` -> required vars checked.
2. App config applies middleware and CORS in `main.ts`.
3. Request hits route guard/decorator in module controllers.
4. Standardized errors and structured logs emitted.

## State/Data Mutations
- No business-entity ownership.
- Owns Prisma connectivity behavior and error boundaries for DB access bootstrap.

## Env Vars Affecting Module
- `DATABASE_URL`, `JWT_SECRET`, `ADMIN_CODE`, `AP_ADMIN_CODE`
- `INSTAGRAM_CLIENT_ID`, `INSTAGRAM_CLIENT_SECRET`, `INSTAGRAM_REDIRECT_URI` (boot validation)
- `PORT`, `CORS_ORIGINS`, `CORS_STRICT`, `MEDIA_ROOT`, `DOTENV_CONFIG_PATH`

## Error and Edge-Case Behavior
- Missing required env in non-test: boot fails immediately.
- Invalid/missing auth headers in guarded routes: `401` legacy envelope.
- CORS strict mode rejects unknown browser origins.

## Security Controls
- Query-based admin/docs secrets removed from guard path.
- JWT issuer validation and role enforcement via guards.
- Header-based credential handling (`Authorization`, `X-Admin-Code`, `X-Docs-Token`).

## Observability
- `http-access` logger in `main.ts` emits request duration + status.
- Guard/service-level JSON logs with scope tags.

## Recent Changes Implemented
- Required env schema validation at startup.
- Header/JWT auth model standardized.
- Structured logger adoption across runtime paths.

## Known Risks and Limits
- Some legacy endpoints still preserve old response body contracts for FE compatibility.
- Misconfigured CORS can block specific browser integrations.

## Ownership and Touchpoints
- Touched by every module.
- Primary dependencies: `database`, `legacy-auth`, `legacy-admin`, `legacy-ap`, `legacy-docs`.

## Failure Mode Example
- **Symptom**: app does not boot after deploy.
- **Why**: missing required env in `validateEnvironment`.
- **Where**: `/Users/reipano/Personal/vehicle-api/src/app.module.ts`.
- **Action**: verify required envs in `ENVIRONMENT_VARIABLES.md` and redeploy.

## Related Docs
- `ARCHITECTURE.md`
- `ENVIRONMENT_VARIABLES.md`
- `RUNBOOKS.md`
