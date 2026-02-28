# Module: legacy-group-b (`LocalPostOrderService`)

## Purpose and Responsibilities
Core write service for post lifecycle and local payment order logic.

Primary code:
- `/Users/reipano/Personal/vehicle-api/src/modules/legacy-group-b/local-post-order.service.ts`

## Public Surface
No direct controller here; consumed by:
- `legacy-data` (create/update post endpoints)
- `legacy-payments` (order create/capture)
- `legacy-ap` / `legacy-admin` internal operations

## Internal Structure
Key domains in one service:
- post create/update/create-user-post
- delete/sold operations
- payment order create/capture
- media fetch validation and normalization

## End-to-End Flows
1. Post mutation endpoint invokes create/update methods.
2. Service validates vendor identity and payload integrity.
3. Transaction writes `post`, `car_detail`, `search` atomically.
4. Payment create/capture uses provider abstraction and strict state transition.
5. Capture updates promotion windows across `post` and `search`.

## State/Data Mutations
- `post`
- `car_detail`
- `search`
- `customer_orders`

## Env Vars Affecting Module
- `JWT_SECRET`
- `MEDIA_FETCH_ALLOWED_HOSTS`
- `PROMOTION_PACKAGE_MAPPING_JSON`
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` (via payments provider when non-test)
- `PAYPAL_CURRENCY_CODE` (default `EUR` for order create)

## Error and Edge-Case Behavior
- Missing/invalid vendor context -> 4xx path
- Capture invalid state -> 409
- Duplicate capture key -> 409
- Provider failure -> 502-tagged payment failure

## Security Controls
- SSRF/LFI protections for media ingestion
- Strict capture state transitions + idempotency marker
- Owner mismatch checks before capture side effects
- Capture amount/currency reconciliation against expected package totals

## Observability
- `local-post-order-service` structured failure code logs (`payment.failure`)

## Recent Changes Implemented
- Atomic multi-table post saves.
- Hardened payment capture/idempotency.
- Payment failure diagnostics with reason codes.
- Promotion package mapping externalization.

## Known Risks and Limits
- Service is broad and still holds multiple domains.

## Ownership and Touchpoints
- Heavy dependency point for `legacy-data`, `legacy-payments`, `legacy-ap`.

## Failure Mode Example
- **Symptom**: payment capture called twice and returns conflict.
- **Why**: idempotency/capture state already completed.
- **Where**: `/Users/reipano/Personal/vehicle-api/src/modules/legacy-group-b/local-post-order.service.ts` capture transition branch.
- **Action**: use same idempotency key and treat completed as terminal.

## Related Docs
- `modules/legacy-payments.md`
- `DATA_MODEL_AND_STATE_TRANSITIONS.md`
