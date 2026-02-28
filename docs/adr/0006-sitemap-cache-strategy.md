# ADR 0006: Sitemap Cache with TTL, Freshness Rules, and In-Flight Dedupe

- Status: `Accepted`
- Date: `2026-02-23`
- Owners: `legacy-sitemap`, `legacy-ap`

## Context
Sitemap generation can be expensive and prone to redundant concurrent generation under traffic bursts. Unbounded regeneration risks performance regression and inconsistent outputs.

## Decision
1. Use in-memory cache entries keyed by sitemap variant.
2. Apply TTL-based freshness and explicit pruning semantics.
3. Deduplicate concurrent requests using in-flight promise tracking.
4. Keep deterministic fallback path when cache misses or generation fails.

## Implementation References
- `/Users/reipano/Personal/vehicle-api/src/modules/legacy-sitemap/legacy-sitemap.service.ts`
- `/Users/reipano/Personal/vehicle-api/src/modules/legacy-ap/ap-sitemap-admin.service.ts`

## Consequences
- Lower DB load for repeated sitemap requests.
- Stable behavior under concurrent traffic.
- Faster p95 response for cached variants.

## Related Docs
- `/Users/reipano/Personal/vehicle-api/docs/modules/legacy-sitemap.md`
- `/Users/reipano/Personal/vehicle-api/docs/RUNBOOKS.md`
