# Module: legacy-group-a (`LocalUserVendorService`)

## Purpose and Responsibilities
Owns core user/vendor identity operations used by legacy auth and related flows:
- login credential verification
- user creation/update
- password reset lifecycle
- role claim sourcing

Primary code:
- `/Users/reipano/Personal/vehicle-api/src/modules/legacy-group-a/local-user-vendor.service.ts`

## Public Surface
No controller directly under this module; used by:
- `legacy-auth`
- `legacy-group-b`
- `legacy-ap`

## Internal Structure
Key operations:
- `login(...)`
- `createUser(...)`
- `updateUser(...)`
- reset/verify password methods
- mail send helper paths (`Resend`)

## End-to-End Flows
1. Caller provides credentials/payload.
2. Service resolves user and verifies password hash.
3. JWT role claims sourced from DB-backed role relations.
4. Legacy envelope returned to caller service/controller.

## State/Data Mutations
- `user`
- `vendor` (depending on flow)
- role join reads (`user_role` / `vendor_role` migration context)

## Env Vars Affecting Module
- `JWT_SECRET`
- `RESEND_API_KEY`

## Error and Edge-Case Behavior
- Invalid credentials -> auth failure envelope.
- DB exceptions mapped to deterministic error responses.
- Missing mail key causes reset-mail path failures.

## Security Controls
- Password hashing migration support (legacy + modern verification path).
- Role assignment derived from DB relations (not username shortcuts).

## Observability
- `local-user-vendor-service` logs for login start/success/failure.

## Recent Changes Implemented
- Password hashing hardening.
- Transactional create-user flow.
- Error precision improvements.
- Rate limiting enforced in controller layer using this service.

## Known Risks and Limits
- `user` entity still present while vendor-only migration is incomplete.

## Ownership and Touchpoints
- Consumed by `legacy-auth`, `legacy-group-b`, and AP services.

## Failure Mode Example
- **Symptom**: users cannot reset password emails.
- **Why**: missing/invalid `RESEND_API_KEY`.
- **Where**: `/Users/reipano/Personal/vehicle-api/src/modules/legacy-group-a/local-user-vendor.service.ts` email send methods.
- **Action**: validate env and mail provider status.

## Related Docs
- `modules/legacy-auth.md`
- `ENVIRONMENT_VARIABLES.md`
