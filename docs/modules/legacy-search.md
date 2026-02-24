# Module: legacy-search

## Purpose and Responsibilities
Provide listing search, count, related, most-wanted, and caption/detail endpoints.

Primary code:
- `/Users/reipano/Personal/vehicle-api/src/modules/legacy-search/legacy-search.controller.ts`
- `/Users/reipano/Personal/vehicle-api/src/modules/legacy-search/legacy-search.service.ts`
- `/Users/reipano/Personal/vehicle-api/src/modules/legacy-search/legacy-search-query-builder.ts`

## Public Surface
Base route: `/car-details`
- `POST /search`
- `POST /result-count`
- `POST /price-calculate`
- `GET /most-wanted`
- `GET /post/:id`
- `GET /post/caption/:id`
- `GET /related-post/:id`
- `POST /related-post-filter`

## Internal Structure
- Controller handles transport/legacy response mapping.
- Query generation moved to `LegacySearchQueryBuilder`.
- Service executes parameterized queries and normalizes output.

## End-to-End Flows
1. Controller reads filter/query params.
2. QueryBuilder parses filter and builds safe SQL fragments/params.
3. Service executes query via Prisma raw-safe param binding.
4. Response normalized (BigInt + caption decode) to client contract.

## State/Data Mutations
- Read-only module (no entity writes by design).

## Env Vars Affecting Module
- No direct search logic envs.
- Timing baseline logs are internal constants.

## Error and Edge-Case Behavior
- Invalid filter JSON -> controlled legacy error.
- `result-count` currently has legacy inflation behavior branch in controller (intentionally preserved).
- General-search tokenization constrained by length/token count.

## Security Controls
- Dynamic list filters are parameterized (no string-concat SQL values).

## Observability
- Per-query timing and slow-warning logs (`query.timing`, `query.slow`).

## Recent Changes Implemented
- Dynamic list parameterization.
- Query builder extraction.
- Query timing baselines.

## Known Risks and Limits
- Result-count inflation branch exists for compatibility and can diverge from real DB total.

## Ownership and Touchpoints
- Consumes `search` and related joined datasets.

## Failure Mode Example
- **Symptom**: search works but total count seems higher than returned pages imply.
- **Why**: controller count-inflation logic.
- **Where**: `/Users/reipano/Personal/vehicle-api/src/modules/legacy-search/legacy-search.controller.ts` (`result-count` path).
- **Action**: validate expected contract before changing behavior.

## Related Docs
- `DATA_MODEL_AND_STATE_TRANSITIONS.md`
- `BEHAVIOR_CATALOG.md`
