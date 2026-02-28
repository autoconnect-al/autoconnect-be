# Module: legacy-favourites

## Purpose and Responsibilities
Resolve and return a filtered subset of favourite post IDs/details from search index.

Primary code:
- `/Users/reipano/Personal/vehicle-api/src/modules/legacy-favourites/legacy-favourites.controller.ts`
- `/Users/reipano/Personal/vehicle-api/src/modules/legacy-favourites/legacy-favourites.service.ts`

## Public Surface
Base route: `/favourites`
- `GET /check`
- `GET /get`

## Internal Structure
- CSV favorites parser
- max list guard (`200` IDs)
- short TTL in-memory cache for repeated equivalent lookups

## End-to-End Flows
1. Parse `favourites` query string into numeric IDs.
2. Reject oversized input (>200 IDs).
3. Build normalized cache key (deduped/sorted list).
4. Return cached result or query `search` table.

## State/Data Mutations
- No DB writes.
- In-memory cache entries only.

## Env Vars Affecting Module
- None directly.

## Error and Edge-Case Behavior
- Oversized favorites list -> 400 with explicit message.
- Empty/invalid list -> success empty array.

## Security Controls
- Input bounded to avoid expensive unbounded `IN (...)` query pressure.

## Observability
- Uses shared HTTP and service logs.

## Recent Changes Implemented
- Upper-bound favorites IDs (`200`).
- TTL cache for repeated requests.

## Known Risks and Limits
- Cache is process-local and ephemeral.

## Ownership and Touchpoints
- Read-only dependency on `search` table.

## Failure Mode Example
- **Symptom**: user gets 400 on favourites endpoint.
- **Why**: requested ID list exceeds max bound.
- **Where**: `/Users/reipano/Personal/vehicle-api/src/modules/legacy-favourites/legacy-favourites.service.ts` (`parseIds`) + `/Users/reipano/Personal/vehicle-api/src/modules/legacy-favourites/legacy-favourites.controller.ts`.
- **Action**: cap requested favorites list in caller.

## Related Docs
- `DATA_MODEL_AND_STATE_TRANSITIONS.md`
- `RUNBOOKS.md`
