# ADR 0004: Split `legacy-ap` Mega Service into Domain Services

- Status: `Accepted`
- Date: `2026-02-23`
- Owners: `legacy-ap`

## Context
`legacy-ap.service.ts` accumulated unrelated responsibilities: role management, user/vendor admin, post tooling, prompts, article handling, sitemap operations, and reminders. This blocked safe changes and increased regression risk.

## Decision
Split by domain and inject focused services:
- `ap-role.service.ts`
- `ap-user-vendor.service.ts`
- `ap-vendor-management.service.ts`
- `ap-post-tooling.service.ts`
- `ap-article.service.ts`
- `ap-prompt.service.ts`
- `ap-make-model.service.ts`
- `ap-sitemap-admin.service.ts`
- `ap-payment-reminder.service.ts`

Retire the mega service and wire controllers to domain services directly.

## Implementation References
- `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/legacy-ap-admin.controller.ts`
- `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/legacy-ap.module.ts`
- `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/ap-*.service.ts`
- removed: `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/legacy-ap.service.ts`

## Consequences
- Smaller units with clearer ownership and easier test targeting.
- Lower blast radius per change.
- Enables domain-specific hardening (query safety, checkpoints, validation).

## Related Docs
- `/Users/reipano/Personal/vehicle-api/docs/modules/legacy-ap.md`
- `/Users/reipano/Personal/vehicle-api/docs/ARCHITECTURE.md`
