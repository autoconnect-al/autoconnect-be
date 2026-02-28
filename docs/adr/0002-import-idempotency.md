# ADR 0002: Import Idempotency Claim/Complete/Fail Model

- Status: `Accepted`
- Date: `2026-02-21`
- Owners: `imports`, `database`

## Context
Import jobs can replay the same upstream record due to retries, queue restarts, or source re-fetches. Without a stable idempotency contract, duplicates and non-deterministic post state occur.

## Decision
1. Add DB-backed idempotency tracking for import payloads.
2. Use a three-phase lifecycle:
- `claim` (processing start)
- `complete` (success marker)
- `fail` (retryable failure marker)
3. Compute keys from source identity + payload hash semantics to skip exact replays.

## Implementation References
- `/Users/reipano/Personal/vehicle-api/src/modules/imports/services/post-import.service.ts`
- `/Users/reipano/Personal/vehicle-api/src/database/prisma.service.ts`
- `/Users/reipano/Personal/vehicle-api/src/modules/imports/services/post-import.service.spec.ts`

## Consequences
- Exact payload replay becomes safe/no-op.
- Changed payload for same source still processes.
- Failed runs can retry cleanly without manual DB cleanup.

## Related Docs
- `/Users/reipano/Personal/vehicle-api/docs/DATA_MODEL_AND_STATE_TRANSITIONS.md`
- `/Users/reipano/Personal/vehicle-api/docs/modules/imports.md`
