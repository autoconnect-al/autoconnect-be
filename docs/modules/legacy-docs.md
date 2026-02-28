# Module: legacy-docs

## Purpose and Responsibilities
Expose guarded OpenAPI metadata for legacy API inspection.

Primary code:
- `/Users/reipano/Personal/vehicle-api/src/modules/legacy-docs/legacy-docs.controller.ts`
- `/Users/reipano/Personal/vehicle-api/src/modules/legacy-docs/legacy-docs.service.ts`

## Public Surface
Routes:
- `GET /openapi.json` (requires `X-Docs-Token`)
- `GET /docs` (requires `X-Docs-Token`)

## Internal Structure
- Header token access check (`DOCS_ACCESS_CODE`)
- Runtime OpenAPI injection from `main.ts`
- Static fallback OpenAPI generator for non-bootstrapped contexts

## End-to-End Flows
1. Request with header token.
2. Access check in service.
3. Return runtime-generated OpenAPI doc (or fallback doc).

## State/Data Mutations
- No DB writes.
- No persistence changes.

## Env Vars Affecting Module
- `DOCS_ACCESS_CODE`

## Error and Edge-Case Behavior
- Invalid/missing docs token -> 404 by design (not-found style guard behavior).

## Security Controls
- Query secret disabled; header token required.

## Observability
- Access behavior relies on standard HTTP logging.

## Recent Changes Implemented
- Query auth replaced with header token auth.
- OpenAPI generation now sourced from runtime decorators/metadata.

## Known Risks and Limits
- If `DOCS_ACCESS_CODE` missing, docs become effectively inaccessible.

## Ownership and Touchpoints
- Uses OpenAPI document injected during app bootstrap.

## Failure Mode Example
- **Symptom**: `/openapi.json` always returns not found.
- **Why**: missing/wrong `X-Docs-Token` or misconfigured `DOCS_ACCESS_CODE`.
- **Where**: `/Users/reipano/Personal/vehicle-api/src/modules/legacy-docs/legacy-docs.service.ts` (`hasAccess`).
- **Action**: validate token header and env config.

## Related Docs
- `ARCHITECTURE.md`
- `ENVIRONMENT_VARIABLES.md`
