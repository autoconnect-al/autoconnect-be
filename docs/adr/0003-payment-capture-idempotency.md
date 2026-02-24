# ADR 0003: Payment Capture Idempotency and Transition Guards

- Status: `Accepted`
- Date: `2026-02-23`
- Owners: `legacy-payments`, `legacy-group-b`

## Context
Capture endpoints were vulnerable to repeated execution and weak transition checks. Reprocessing a completed order could duplicate side effects (promotion updates and status writes).

## Decision
1. Enforce strict order transition rules (`CREATED -> COMPLETED` once).
2. Make repeated capture requests idempotent when order is already completed.
3. Wrap capture status update + promotion side effects in one transaction.
4. Validate ownership where identifying fields are available.

## Implementation References
- `/Users/reipano/Personal/vehicle-api/src/modules/legacy-group-b/local-post-order.service.ts`
- `/Users/reipano/Personal/vehicle-api/src/modules/legacy-group-b/local-post-order.service.spec.ts`

## Consequences
- Eliminates duplicate capture side effects.
- Improves client retry safety on network failures.
- Returns deterministic responses for repeated capture attempts.

## Related Docs
- `/Users/reipano/Personal/vehicle-api/docs/modules/legacy-payments.md`
- `/Users/reipano/Personal/vehicle-api/docs/RUNBOOKS.md`
