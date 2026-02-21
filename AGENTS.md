# AGENTS.md

## Project Summary
- Repository: `vehicle-api`
- Stack: NestJS + Prisma + MySQL
- Goal: PHP parity rewrite for legacy backend behavior and contracts.
- Main parity source: `/Users/reipano/Personal/tregu-makinave`
- Pattern: legacy-compatible controllers + service-layer business logic + Prisma DB access.

## Important Modules
- `src/modules/legacy-ap`: AP/admin/tooling compatibility endpoints.
- `src/modules/legacy-group-b`: post/order write flows (`save-post`, `update-post`, payments capture).
- `src/modules/imports`: importer flows and AI/import result processing.
- `src/modules/legacy-data`: data-facing endpoints used by app clients.
- `src/modules/legacy-search`: search/read models and query behavior.
- `src/modules/legacy-auth`: auth/login/reset-password compatible routes.
- `src/modules/legacy-payments`: order create/capture endpoints under `/api/v1/orders`.
- `src/modules/legacy-group-a`: user/vendor create/update logic reused by AP and other modules.

## Key Runtime Notes
- API uses env-based access codes for legacy-compatible endpoints:
  - `CODE` for AP/backoffice tooling routes.
  - `DOCS_ACCESS_CODE` for `/docs` and `/openapi.json`.
- Guards used frequently:
  - `ApCodeGuard` for AP tooling/admin compatibility routes.
  - `LegacyJwtGuard` / `LegacyJwtAdminGuard` for legacy JWT protected routes.
- Prisma schema is in `prisma/schema.prisma`.
- Legacy contract behavior uses `{ success, message, statusCode, result }` style response envelopes in many routes.

## Node Version
- Use Node 20 for this project.
- If your current Node is older, switch using `nvm`:
```bash
nvm install 20
nvm use 20
node -v
```

## Local Setup
- Install deps: `npm install`
- Pull/generate Prisma artifacts when schema/db changes:
```bash
npm run prisma:pull
npm run prisma:generate
```
- Start API:
```bash
npm run start:dev
```

## Common Commands
- Run tests: `npm test`
- Run a single test file:
```bash
npm test -- modules/legacy-ap/legacy-ap.service.spec.ts
```
- Run AP contract suites:
  - `npm run contract:diff:ap:auth`
  - `npm run contract:diff:ap:admin`
  - `npm run contract:diff:ap:tooling`
- Generate AP endpoint ownership matrix:
```bash
npm run contract:matrix:ap
```

## High-Value Endpoint Areas
- AP tooling/admin controllers:
  - `src/modules/legacy-ap/legacy-ap-admin.controller.ts`
  - Includes `/post/*`, `/car-details/*`, `/vendor-management/*`, role/user/vendor management routes.
- Data API controllers:
  - `src/modules/legacy-data/legacy-data.controller.ts`
  - Includes `/data/create-post`, `/data/update-post`, article/make/model/vendor read routes.
- Payments:
  - `src/modules/legacy-payments/legacy-payments.controller.ts`
  - Includes `/api/v1/orders` and `/api/v1/orders/:orderID/capture`.

## Core Data Model (Prisma)
- Main tables/entities used most often:
  - `post`: post lifecycle, vendor relation, promotions (`promotionTo`, `highlightedTo`, `renewTo`, `mostWantedTo`, `renewInterval`, `renewedTime`).
  - `car_detail`: vehicle details tied to post (`post_id`), verification flags, publish/sold state.
  - `search`: denormalized/search-facing projection of post + car details.
  - `vendor`, `user`, `role`: account and management entities.
- ID convention:
  - Many IDs are `BigInt`; preserve conversion handling at API boundaries.

## Known Behavior / Caveats
- `POST /post/posts` mapping is manual in service and can omit DB fields unless explicitly mapped.
- Import/admin endpoints can parse partial payloads; absent fields often fallback to existing DB values.
- Legacy parity sometimes intentionally mirrors non-ideal behavior for contract compatibility; check tests before “cleanup” refactors.

## Promotion Field Guardrail (Critical)
- Promotion fields (`promotionTo`, `highlightedTo`, `renewTo`, `mostWantedTo`, `renewInterval`, `renewedTime`) are protected by `src/common/promotion-field-guard.util.ts`.
- Policy: only payment and auto-renew flows may write promotion fields. Untrusted import/edit flows must not overwrite them.
- Allowed writers:
  - Order capture package flow in `src/modules/legacy-group-b/local-post-order.service.ts`.
  - Auto-renew flow in `src/modules/legacy-ap/legacy-ap.service.ts`.

## Verification and Debugging Workflow
- For write bugs, trace in this order:
  1. Controller route -> service method
  2. Prisma `update/create/upsert` payload shape
  3. Response mapper fields (many responses are flattened manually)
- For parity issues:
  - Use contract diff scripts in `test/contracts` and review `test/contracts/report.json`.
- For AP route ownership:
  - Check `docs/migration/ap-endpoint-matrix.json`.
