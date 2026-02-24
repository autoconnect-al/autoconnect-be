# Module: legacy-payments

## Purpose and Responsibilities
Expose payment order create/capture API and delegate business logic to post/order service.

Primary code:
- `/Users/reipano/Personal/vehicle-api/src/modules/legacy-payments/legacy-payments.controller.ts`
- `/Users/reipano/Personal/vehicle-api/src/modules/legacy-payments/legacy-payments.module.ts`
- `/Users/reipano/Personal/vehicle-api/src/modules/legacy-payments/payment-provider.ts`

## Public Surface
Base route: `/api/v1/orders`
- `POST /`
- `POST /:orderID/capture` (accepts `X-Idempotency-Key`)

## Internal Structure
- Controller handles transport-level legacy error envelope mapping.
- `LocalPostOrderService` owns business rules.
- `PaymentProvider` abstraction decouples gateway behavior.

## End-to-End Flows
1. Create order validates payload/package/post ownership.
2. Provider creates order reference.
3. Capture endpoint validates state and idempotency.
4. Provider capture called.
5. DB transition + promotion side effects committed transactionally.

## State/Data Mutations
- `customer_orders`
- `post` and `search` promotion fields on capture

## Env Vars Affecting Module
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- Optional: `PAYPAL_ENV`, `PAYPAL_BASE_URL`, `PAYPAL_CURRENCY_CODE`, `PAYMENT_PROVIDER_MODE`
- Indirect via provider/service dependencies (`PROMOTION_PACKAGE_MAPPING_JSON`, `JWT_SECRET`)

## Error and Edge-Case Behavior
- Invalid input -> 400
- Missing entities -> 404
- owner mismatch -> 403
- invalid transition / duplicate capture key -> 409
- provider exception -> 502

## Security Controls
- Capture idempotency with unique key marker
- Strict transition checks (`CREATED` -> `COMPLETED` only)

## Observability
- Structured payment failure reason codes logged

## Recent Changes Implemented
- Strict order state and idempotent capture markers.
- Payment failure diagnostics.
- Provider integration abstraction.

## Known Risks and Limits
- Wrong PayPal environment selection (`PAYPAL_ENV` / `PAYPAL_BASE_URL`) can route payments to sandbox/live unintentionally.

## Ownership and Touchpoints
- Coupled with `legacy-group-b` order and promotion logic.

## Failure Mode Example
- **Symptom**: capture returns conflict.
- **Why**: order already completed or not in allowed transition state.
- **Where**: `/Users/reipano/Personal/vehicle-api/src/modules/legacy-group-b/local-post-order.service.ts` capture branch.
- **Action**: inspect `customer_orders.status` and capture key.

## Related Docs
- `modules/legacy-group-b.md`
- `DATA_MODEL_AND_STATE_TRANSITIONS.md`
