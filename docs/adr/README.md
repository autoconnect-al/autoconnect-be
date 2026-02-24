# Architecture Decision Records (ADR)

## Purpose
This folder records major architecture and design decisions that affect security, reliability, and maintainability.

Use ADRs when behavior changed because of an explicit tradeoff, not for every small refactor.

## Status Legend
- `Accepted`: decision is active and should guide future changes.
- `Superseded`: replaced by a newer ADR (link required).
- `Deprecated`: no longer preferred, but may still exist in legacy paths.

## Index
1. [0001 - Admin auth via header/JWT (remove query code auth)](./0001-admin-auth-header-jwt.md) - `Accepted`
2. [0002 - Import idempotency claim/complete/fail model](./0002-import-idempotency.md) - `Accepted`
3. [0003 - Payment capture idempotency and transition guards](./0003-payment-capture-idempotency.md) - `Accepted`
4. [0004 - Split legacy-ap mega service into domain services](./0004-legacy-ap-service-split.md) - `Accepted`
5. [0005 - Extract search query builder responsibilities](./0005-search-query-builder-extraction.md) - `Accepted`
6. [0006 - Sitemap cache strategy with TTL and in-flight dedupe](./0006-sitemap-cache-strategy.md) - `Accepted`

## Cross Links
- `/Users/reipano/Personal/vehicle-api/docs/ARCHITECTURE.md`
- `/Users/reipano/Personal/vehicle-api/docs/RUNBOOKS.md`
- `/Users/reipano/Personal/vehicle-api/docs/IMPLEMENTED_CHANGES_BY_MODULE.md`
