# Module: legacy-sitemap

## Purpose and Responsibilities
Generate sitemap payloads for autoconnect and article apps.

Primary code:
- `/Users/reipano/Personal/vehicle-api/src/modules/legacy-sitemap/legacy-sitemap.controller.ts`
- `/Users/reipano/Personal/vehicle-api/src/modules/legacy-sitemap/legacy-sitemap.service.ts`

## Public Surface
Base route: `/sitemap`
- `GET /data`
- `GET /get-sitemap/:appName`

## Internal Structure
- Static route path-name maps for locale alternates
- Data-source reads from `search` and `article`
- In-memory cache with TTL + in-flight dedupe

## End-to-End Flows
1. Request arrives for default/app sitemap.
2. Cache checked by key:
  - `autoconnect-default`
  - `article-app:<appName>`
3. On miss, service queries source table(s), builds sitemap items, stores cache.
4. On concurrent miss same key, in-flight promise is awaited.

## State/Data Mutations
- Read-only DB behavior.
- In-memory cache state mutation in service instance.

## Env Vars Affecting Module
- `BASE_URL`
- `SITEMAP_CACHE_TTL_SECONDS`

## Error and Edge-Case Behavior
- Unknown appName -> empty result set.
- Missing localized article titles -> entries may be skipped or partially alternated.

## Security Controls
- No auth enforced on sitemap routes (public by design).

## Observability
- Cache hit/miss/await-inflight logs.

## Recent Changes Implemented
- EN alternate path correctness fixes.
- Cache + TTL + in-flight dedupe to reduce heavy scans.
- Snapshot test coverage for route regressions.

## Known Risks and Limits
- In-memory cache is per-process; multi-instance deployments do not share cache.

## Ownership and Touchpoints
- Depends on `search` and `article` data quality.

## Failure Mode Example
- **Symptom**: sitemap latency spikes after deploy.
- **Why**: cache disabled by very low TTL or process restarts forcing misses.
- **Where**: `/Users/reipano/Personal/vehicle-api/src/modules/legacy-sitemap/legacy-sitemap.service.ts` (`getCachedSitemap`).
- **Action**: adjust TTL and inspect process stability.

## Related Docs
- `RUNBOOKS.md`
- `ENVIRONMENT_VARIABLES.md`
