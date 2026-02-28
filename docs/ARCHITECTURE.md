# Architecture Handbook

## System Overview
`vehicle-api` is a NestJS monolith that serves legacy-compatible HTTP APIs and internal operational/admin workflows.

Primary runtime layers:
1. **HTTP / App bootstrap**: `src/main.ts`, `src/app.module.ts`
2. **Cross-cutting concerns**: guards, auth parsing, logging, env validation, Prisma access (`src/common/*`, `src/database/*`)
3. **Domain modules**: `src/modules/*`
4. **Data store**: MySQL via Prisma (`prisma/schema.prisma`, `src/database/prisma.service.ts`)

## Runtime Model
- Framework: NestJS
- Transport: HTTP JSON + legacy response envelope
- Auth styles:
  - JWT bearer for user/admin flows
  - Header code (`X-Admin-Code`) for transitional machine paths
  - Docs header token (`X-Docs-Token`)
- Queueing:
  - BullMQ when enabled (`IMPORT_QUEUE_ENABLED=true`)
  - Inline fallback when queue disabled
- Storage:
  - MySQL primary persistence
  - Local filesystem media storage (`MEDIA_ROOT` / `UPLOAD_DIR`)

## Module Boundaries
Imported by `src/app.module.ts`:
- `LegacyAuthModule`
- `LegacySearchModule`
- `LegacyDataModule`
- `LegacyFavouritesModule`
- `LegacyAdminModule`
- `LegacySitemapModule`
- `LegacyDocsModule`
- `LegacyPaymentsModule`
- `LegacyApModule`
- `IngestModule`

## Request Lifecycle
1. Request enters Nest app (`src/main.ts`)
2. CORS/JSON/urlencoded middleware applies
3. Route-level guard/auth decorators validate access
4. Controller forwards to service(s)
5. Service queries/updates Prisma models
6. Response is returned as legacy envelope or explicit JSON contract

## Core Data Flows

### Auth Flow
- Entry: `legacy-auth.controller.ts`
- Logic: `legacy-auth.service.ts`, `local-user-vendor.service.ts`
- Controls: `AuthRateLimitGuard`, JWT parsing/verification utilities
- Side effects: user/vendor auth state, password reset, role lookup

### Import Flow
- Entry:
  - `imports/apify-import/apify-import.controller.ts`
  - `imports/encar-import/encar.controller.ts`
  - `imports/post.controller.ts`
- Queue orchestration: `imports/queue/*`
- Core write path: `imports/services/post-import.service.ts`
- Remote AP save integration: `imports/remote-post-saver.service.ts`
- Side effects: post/car_detail/vendor writes, idempotency record updates, media download/storage

### Publish/Search Sync Flow
- Admin/AP tooling entry: `legacy-ap/legacy-ap-admin.controller.ts` -> `ApPostToolingService`
- Search population: `ApPostToolingService.rebuildSearchFromPosts()`
- Side effects:
  - Upsert into `search`
  - Post status transition `TO_BE_PUBLISHED` -> `PUBLISHED` after successful search upsert
  - Optional stale search prune only when enabled

### Payments Flow
- Entry: `legacy-payments.controller.ts`
- Logic: `legacy-group-b/local-post-order.service.ts`
- Provider abstraction: `legacy-payments/payment-provider.ts`
- Side effects:
  - `customer_orders` create/capture transitions
  - Promotion field updates on `post` and `search`

### Sitemap Flow
- Entry: `legacy-sitemap.controller.ts`
- Logic: `legacy-sitemap.service.ts`
- Sources: `search` + `article`
- Caching: in-memory key+TTL cache with in-flight deduplication

### Docs/OpenAPI Flow
- Entry: `legacy-docs.controller.ts`
- Logic: `legacy-docs.service.ts`
- Access control: `X-Docs-Token`
- OpenAPI source: runtime-generated doc injected from `main.ts` (fallback to static route map)

## Security Architecture
- Required environment validation at boot in `src/app.module.ts`
- JWT secret is mandatory (`requireEnv('JWT_SECRET')` usage)
- Admin routes use `LegacyJwtAdminGuard` where enforced
- AP/docs code moved off query params to headers
- Media ingestion SSRF/LFI protections in `local-media.service.ts` and `local-post-order.service.ts`

## Observability Architecture
- Structured logger utility: `src/common/logger.util.ts`
- HTTP access logging in `src/main.ts`
- Search query timing baselines in `legacy-search.service.ts`
- Cache hit/miss telemetry in sitemap and other modules

## Failure Domains
1. **Configuration failures**: missing required env -> boot fail
2. **DB connectivity/schema mismatch**: Prisma errors at runtime
3. **Queue/Redis unavailable**: queue mode disabled/failing, fallback path used when configured
4. **External API dependency failures**: Apify, OpenAI, Instagram, Resend, remote AP
5. **Filesystem/media failures**: upload/download conversion failures

## Responsibility Map
- Auth and identity: `legacy-auth`, `legacy-group-a`
- Posts/orders/media write operations: `legacy-group-b`
- Imports and ingestion orchestration: `imports`
- Search query and filtering contract: `legacy-search`
- Admin API (legacy FE): `legacy-admin`
- AP/internal management tooling: `legacy-ap`
- Sitemap generation: `legacy-sitemap`
- Payment order API: `legacy-payments`
- Docs exposure: `legacy-docs`
- Favourites endpoints: `legacy-favourites`

## Related Docs
- `ENVIRONMENT_VARIABLES.md`
- `DATA_MODEL_AND_STATE_TRANSITIONS.md`
- `RUNBOOKS.md`
- `BEHAVIOR_CATALOG.md`
- `modules/*.md`
