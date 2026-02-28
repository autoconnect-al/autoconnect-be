# ADR 0005: Extract and Isolate Search Query Builder Responsibilities

- Status: `Accepted`
- Date: `2026-02-23`
- Owners: `legacy-search`, `legacy-ap`

## Context
Dynamic search filters and SQL fragment construction were distributed and partially duplicated, increasing risk of drift and unsafe interpolation.

## Decision
1. Consolidate query-building responsibility into dedicated logic/repository boundaries.
2. Replace dynamic unsafe SQL patterns with parameterized `Prisma.sql` fragments.
3. Keep controller/service orchestration separate from query construction rules.

## Implementation References
- `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/ap-post-tooling.service.ts`
- `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/ap-prompt.repository.ts`
- `/Users/reipano/Personal/vehicle-api/src/modules/legacy-search/*`

## Consequences
- Clearer contract for filtering behavior.
- Safer dynamic query generation.
- Easier parity checks between API responses and DB behavior.

## Related Docs
- `/Users/reipano/Personal/vehicle-api/docs/modules/legacy-search.md`
- `/Users/reipano/Personal/vehicle-api/docs/BEHAVIOR_CATALOG.md`
