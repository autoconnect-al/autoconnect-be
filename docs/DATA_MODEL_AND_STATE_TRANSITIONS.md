# Data Model and State Transitions

## Purpose
Document key runtime entities and explicit lifecycle transitions used in production behavior.

## Primary Runtime Tables
- `post`
- `car_detail`
- `search`
- `customer_orders`
- `import_idempotency`
- `prompt_import_job`
- `vendor`, `user`, `role`, `vendor_role`
- `article`

(See `prisma/schema.prisma` for structural definitions.)

## Post Lifecycle

## Status lifecycle (app-level)
- Common values observed: `DRAFT`, `TO_BE_PUBLISHED`, `PUBLISHED`

Transition highlights:
1. Import/create paths often initialize as `DRAFT`.
2. AP search rebuild promotes `TO_BE_PUBLISHED` -> `PUBLISHED` only after successful `search` upsert.
3. Delete/sold flows mark related records deleted/sold and impact visibility.

## Visibility lifecycle
- Visibility in client search relies on `search` row presence and flags (`deleted`, `sold`, `type`, etc).
- `post` alone is not sufficient for search result visibility.

## Order Lifecycle (`customer_orders`)

States:
- `CREATED`
- `COMPLETED`

Capture transition rules:
1. `CREATED` -> `COMPLETED` allowed.
2. `COMPLETED` capture is idempotent stable return.
3. Any other state -> conflict.

Idempotency fields:
- `captureKey` (unique)
- `capturedAt`

Side effects on successful capture:
- promotion windows updated in `post`
- corresponding fields updated in `search`

## Import Idempotency Lifecycle (`import_idempotency`)

States:
- `processing`
- `completed`
- `failed`

Flow:
1. Claim row with key+payload hash.
2. If exists and completed/processing -> skip duplicate execution.
3. If failed -> reclaim and retry path.
4. Mark completed/failed terminal status after run.

## Sitemap Cache Lifecycle (in-memory)

Keys:
- `autoconnect-default`
- `article-app:<appName>`

States:
- miss -> build -> set `expiresAt`
- hit -> return cached
- in-flight -> await single shared promise

Controls:
- TTL via `SITEMAP_CACHE_TTL_SECONDS`

## Search Rebuild Safety Lifecycle
- Rebuild scans source posts by horizon.
- Upserts into `search`.
- Optional prune of stale `search` rows only if:
  - at least one upsert happened
  - `SEARCH_REBUILD_PRUNE_STALE=true`

This prevents empty-table destructive cleanup scenarios.

## Identity/Role Model (current)
- Auth still touches `user` and related role mappings in legacy flows.
- `vendor_role` introduced for vendor-role model evolution.
- Role enforcement in admin paths uses role claims including `ADMIN`.

## Cross-Table Mutation Groups

## Post write transaction group
- `post` + `car_detail` + `search` written atomically in key mutation paths.

## Payment capture transaction group
- `customer_orders` transition + `post` promotions + `search` promotions.

## Related Docs
- `ARCHITECTURE.md`
- `modules/legacy-group-b.md`
- `modules/legacy-payments.md`
- `modules/legacy-ap.md`
