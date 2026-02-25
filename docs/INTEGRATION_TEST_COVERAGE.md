# Integration Test Coverage

## Purpose
This document is the authoritative map of **integration test** coverage in `vehicle-api`.

It answers:
- what is tested,
- what is not covered,
- and where coverage gaps still exist, grouped by module and functionality.

## Scope
- Included: `test/integration/*.int-spec.ts`
- Excluded: unit tests, deprecated contract diff suites, performance/load testing.

Last updated: 2026-02-25  
Owner: Backend/API maintainers

## Methodology
Coverage map inputs:
- `/Users/reipano/Personal/vehicle-api/test/integration/auth-and-guards.int-spec.ts`
- `/Users/reipano/Personal/vehicle-api/test/integration/read-search-and-sitemap.int-spec.ts`
- `/Users/reipano/Personal/vehicle-api/test/integration/search-matrix.int-spec.ts`
- `/Users/reipano/Personal/vehicle-api/test/integration/write-and-payments.int-spec.ts`
- `/Users/reipano/Personal/vehicle-api/test/integration/payments-provider-failures.int-spec.ts`
- `/Users/reipano/Personal/vehicle-api/test/integration/sitemap-cache.int-spec.ts`
- `/Users/reipano/Personal/vehicle-api/test/integration/data-upload-image.int-spec.ts`
- `/Users/reipano/Personal/vehicle-api/test/integration/favourites.int-spec.ts`
- `/Users/reipano/Personal/vehicle-api/test/integration/admin-mutations.int-spec.ts`
- `/Users/reipano/Personal/vehicle-api/test/integration/docs-gate.int-spec.ts`
- `/Users/reipano/Personal/vehicle-api/test/integration/imports.int-spec.ts`
- `/Users/reipano/Personal/vehicle-api/test/integration/ap-admin-tooling.int-spec.ts`
- module edge-case docs under `/Users/reipano/Personal/vehicle-api/docs/modules/*.md`

Coverage rule:
- A behavior is marked `Covered` only if there is an explicit integration assertion for it.
- `Partially Covered` means a related happy/negative path exists, but not all high-risk variants are asserted.
- `Not Covered` means no explicit integration assertion exists.

## Coverage Matrix

### Module: legacy-search
| Functionality | Endpoint(s) | Covered by test(s) | Assertions performed | Status |
|---|---|---|---|---|
| Invalid filter envelope | `POST /car-details/search` | `search-matrix.int-spec.ts` | `500` legacy envelope for invalid JSON | Covered |
| Filter matrix (price, in-clauses, customsPaid, keyword, normalization) | `POST /car-details/search` | `search-matrix.int-spec.ts` | Result correctness by seeded data and filters | Covered |
| Sorting + pagination | `POST /car-details/search` | `search-matrix.int-spec.ts` | Correct page subset/order | Covered |
| Promoted injection + highlighted flags | `POST /car-details/search` | `search-matrix.int-spec.ts` | promoted-first, fallback, no-promoted, dedup, additive count, `highlighted` derivation | Covered |
| Result count behavior | `POST /car-details/result-count` | `read-search-and-sitemap.int-spec.ts`, `search-matrix.int-spec.ts` | deterministic count and inflation branches (`+500`, `+1200`, boundary) | Covered |
| Related by filter and by post id | `POST /car-details/related-post-filter`, `GET /car-details/related-post/:id` | `search-matrix.int-spec.ts` | promoted-first, fallback, no-promoted, excluded IDs | Covered |
| Most wanted exclusions + promotion fields | `GET /car-details/most-wanted` | `search-matrix.int-spec.ts` | exclusion params and projection fields | Covered |
| Price calculation basic path | `POST /car-details/price-calculate` | `search-matrix.int-spec.ts` | success envelope + non-empty array for valid terms | Covered |
| Caption/detail endpoints | `GET /car-details/post/:id`, `GET /car-details/post/caption/:id` | `read-search-and-sitemap.int-spec.ts` | success + not-found (`404`), caption normalization and media field behavior | Covered |
| General-search guardrails | `POST /car-details/search` | `search-matrix.int-spec.ts` | >75 char input ignored and 10-token cap behavior asserted | Covered |

### Module: legacy-data
| Functionality | Endpoint(s) | Covered by test(s) | Assertions performed | Status |
|---|---|---|---|---|
| Create/update post graph | `POST /data/create-post`, `POST /data/update-post` | `write-and-payments.int-spec.ts` | envelope + writes/updates in `post/car_detail/search` | Covered |
| Invalid payload handling | `POST /data/create-post` | `write-and-payments.int-spec.ts` | legacy error envelope + no row writes | Covered |
| Promotion field guardrail on update | `POST /data/update-post` | `write-and-payments.int-spec.ts` | untrusted promotion fields cannot overwrite persisted values | Covered |
| Read makes endpoint | `GET /data/makes` | `read-search-and-sitemap.int-spec.ts` | expected make list and type filtering | Covered |
| Upload image validation/security paths | `POST /data/upload-image` | `data-upload-image.int-spec.ts` | rejects remote URL, local path, unsupported mime, invalid payload, oversized multipart upload | Covered |
| Articles/vendors metadata permutations | `/data/article*`, `/data/articles*`, `/data/related/articles*`, `/data/latest/articles*`, `/data/metadata/articles*`, `/data/vendors*` | `read-search-and-sitemap.int-spec.ts` | language filtering, related exclusion, metadata missing-id envelope, vendor biography normalization, app/category semantics | Covered |
| Models + motorcycle read paths | `GET /data/models/:make`, `GET /data/makes/motorcycles`, `GET /data/models/motorcycles/:make` | `read-search-and-sitemap.int-spec.ts` | make normalization, `full=true` payload, motorcycle-only make/model sets | Covered |
| Create user and post path | `POST /data/create-user-post` | `write-and-payments.int-spec.ts` | creates vendor+post graph for new email and returns legacy 500 envelope for invalid payload | Covered |

### Module: legacy-group-b (via legacy-data + legacy-payments + legacy-admin)
| Functionality | Endpoint(s) | Covered by test(s) | Assertions performed | Status |
|---|---|---|---|---|
| Atomic write graph expectations | `POST /data/create-post`, `POST /data/update-post` | `write-and-payments.int-spec.ts` | persisted graph reflects intended mutation state | Covered |
| Promotion update protection | `POST /data/update-post` | `write-and-payments.int-spec.ts` | promotion fields preserved against untrusted payload | Covered |
| Capture side effects to post/search | `POST /api/v1/orders/:orderID/capture` | `write-and-payments.int-spec.ts` | `customer_orders` transition + promotion propagation | Covered |
| Idempotent capture behavior | `POST /api/v1/orders/:orderID/capture` | `write-and-payments.int-spec.ts` | repeated capture is stable terminal behavior | Covered |
| Owner mismatch + forbidden path | create/capture flow | `write-and-payments.int-spec.ts` | explicit `403` assertions for mismatched owner email in create and capture | Covered |
| Invalid transition conflict path | capture flow | `write-and-payments.int-spec.ts` | non-`CREATED` status capture returns `409` | Covered |
| Admin delete/sold mutation paths | `DELETE /admin/posts/:id`, `PATCH /admin/posts/:id/sold` | `admin-mutations.int-spec.ts` | post graph delete and sold projection sync to `car_detail/search` | Covered |

### Module: legacy-payments
| Functionality | Endpoint(s) | Covered by test(s) | Assertions performed | Status |
|---|---|---|---|---|
| Create/capture core paths | `POST /api/v1/orders`, `POST /api/v1/orders/:orderID/capture` | `write-and-payments.int-spec.ts` | create state, capture completion, idempotency, unknown order | Covered |
| Provider failure mapping | order create/capture | `payments-provider-failures.int-spec.ts` | provider create/capture exceptions map to `502` legacy envelope | Covered |
| Webhook signature/negative paths | `POST /api/v1/orders/paypal/webhook` | `payments-provider-failures.int-spec.ts` | invalid signature returns `400` legacy envelope | Covered |

### Module: legacy-auth
| Functionality | Endpoint(s) | Covered by test(s) | Assertions performed | Status |
|---|---|---|---|---|
| Login + refresh token matrix | `POST /authentication/login`, `GET /user/refresh-token` | `auth-and-guards.int-spec.ts` | invalid, success, unauthorized, valid token refresh | Covered |
| Instagram access token negative path | `GET /instagram-sync/get-access-token` | `auth-and-guards.int-spec.ts` | expected legacy failure payload | Covered |
| Rate limiting behavior | login guarded route | `auth-and-guards.int-spec.ts` | repeated login attempts return `429` legacy envelope | Covered |
| Reset/verify/create-user flows | `POST /user/reset-password`, `POST /user/verify-password`, `POST /user/create-user` | `auth-and-guards.int-spec.ts` | success path assertions with persistence checks | Covered |

### Module: legacy-sitemap
| Functionality | Endpoint(s) | Covered by test(s) | Assertions performed | Status |
|---|---|---|---|---|
| Sitemap data + app route | `GET /sitemap/data`, `GET /sitemap/get-sitemap/:appName` | `read-search-and-sitemap.int-spec.ts`, `sitemap-cache.int-spec.ts` | happy path, unknown app, configured app content | Covered |
| Cache/TTL/staleness behavior | sitemap cache layer | `sitemap-cache.int-spec.ts` | stale-on-hit before TTL and refresh-after-TTL with new data | Covered |

### Module: legacy-admin
| Functionality | Endpoint(s) | Covered by test(s) | Assertions performed | Status |
|---|---|---|---|---|
| Guard matrix for admin routes | `/admin/*` | `admin-mutations.int-spec.ts` | unauthorized (`401`), non-admin (`401`), admin success | Covered |
| Post detail read behavior | `GET /admin/posts/:id` | `admin-mutations.int-spec.ts` | owner hit returns payload, missing id returns legacy success with `null` result | Covered |
| Post mutation behavior | `DELETE /admin/posts/:id`, `PATCH /admin/posts/:id/sold` | `admin-mutations.int-spec.ts` | delete graph updates; sold transition updates projection | Covered |
| Not-owner mutation failures | `DELETE /admin/posts/:id`, `PATCH /admin/posts/:id/sold` | `admin-mutations.int-spec.ts` | non-owner admin mutation attempts return legacy error envelopes and preserve DB state | Covered |
| User and vendor mutations | `POST /admin/user`, `POST /admin/user/change-password`, `/admin/vendor/*` | `admin-mutations.int-spec.ts` | success persistence checks + invalid payload legacy envelope for user endpoints | Covered |

### Module: legacy-favourites
| Functionality | Endpoint(s) | Covered by test(s) | Assertions performed | Status |
|---|---|---|---|---|
| Favourites filtering | `GET /favourites/check`, `GET /favourites/get` | `favourites.int-spec.ts` | active-only filtering (`sold=0`, `deleted=0`) and row payload checks | Covered |
| Input bounds and invalid list behavior | `GET /favourites/check`, `GET /favourites/get` | `favourites.int-spec.ts` | oversized list legacy `400` envelope, invalid/empty list success empty array | Covered |
| Duplicate normalization behavior | `GET /favourites/check` | `favourites.int-spec.ts` | duplicate/reordered ids hit same normalized cache key behavior | Covered |
| Cache TTL refresh path | `GET /favourites/check` | `favourites.int-spec.ts` | expired cache entry refreshes from DB and reflects updated sold/deleted state | Covered |

### Module: legacy-docs
| Functionality | Endpoint(s) | Covered by test(s) | Assertions performed | Status |
|---|---|---|---|---|
| Header token gate for OpenAPI/docs routes | `GET /openapi.json`, `GET /docs` | `docs-gate.int-spec.ts` | missing/invalid token returns `404`; valid token returns OpenAPI payload/docs metadata | Covered |

### Module: imports
| Functionality | Endpoint(s) | Covered by test(s) | Assertions performed | Status |
|---|---|---|---|---|
| Post metric increment transport validation | `POST /posts/:postId/increment` | `imports.int-spec.ts` | invalid metric returns `400`; valid requests return async `202` queued-inline envelope | Covered |
| Post metric side effects | `POST /posts/:postId/increment` | `imports.int-spec.ts` | postOpen+clicks increments, impressions/reach dedupe by visitor, contact + method counters | Covered |
| Admin-guarded import triggers | `POST /apify/import`, `POST /encar/scrape` | `imports.int-spec.ts` | unauthorized `401`; valid `x-admin-code` returns `202` queued-inline in queue-disabled mode | Covered |
| Import idempotency replay | `PostImportService.importPost` integration path | `imports.int-spec.ts` | identical payload replay is skipped; idempotency row remains `completed` with single attempt | Covered |
| Old/sold cleanup branches | `PostImportService.importPost` integration path | `imports.int-spec.ts` | old existing posts are deleted on re-import; sold-caption branch marks post/car_detail deleted/sold | Covered |
| Image download force-window behavior | `PostImportService.importPost` integration path | `imports.int-spec.ts` | `forceDownloadImagesDays` blocks forced rewrite for old posts and enables rewrite for recent posts | Covered |
| OpenAI enrichment toggle branch | `PostImportService.importPost` integration path | `imports.int-spec.ts` | `useOpenAI=true` path uses OpenAI-derived details when extractor returns populated payload | Covered |

### Module: legacy-ap
| Functionality | Endpoint(s) | Covered by test(s) | Assertions performed | Status |
|---|---|---|---|---|
| Guard enforcement for AP admin groups | `role-management`, `make-model-data` | `ap-admin-tooling.int-spec.ts` | unauthorized requests return `401`; admin JWT authorized flow succeeds | Covered |
| Role management write flows | `POST /role-management/create-role`, `POST /role-management/update-role/:id`, `DELETE /role-management/delete-role/:id`, `POST /role-management/grant-admin/:id`, `POST /role-management/revoke-admin/:id` | `ap-admin-tooling.int-spec.ts` | role CRUD persistence and admin role links grant/revoke | Covered |
| User/vendor management writes | `POST /user-management/create-user`, `GET /user-management/user/:id`, `GET /user-management/user/username/:username`, `POST /user-management/update-user/:id`, `DELETE /user-management/delete-user/:id`, `POST /vendor-management/add/:id`, `POST /vendor-management/add/details/:id`, `POST /vendor-management/edit/:id`, `POST /vendor/update`, `DELETE /vendor/delete/:id` | `ap-admin-tooling.int-spec.ts` | create/read/update/delete user and vendor detail mutation persistence | Covered |
| AP make/model data endpoints | `GET /make-model-data/makes`, `GET /make-model-data/models/motorcycle/:make` | `ap-admin-tooling.int-spec.ts` | returns expected car/motorcycle datasets via admin route wrappers | Covered |
| AP article endpoints | `POST /article/create`, `POST /article/update/:id`, `GET /article/:id`, `GET /article/all` | `ap-admin-tooling.int-spec.ts` | article create/read/update/list persistence assertions | Covered |
| AP code-guard tooling smoke | `GET /post/posts` | `ap-admin-tooling.int-spec.ts` | `401` without AP code, success with valid `x-admin-code` and seeded ids | Covered |
| AP post write compatibility routes | `POST /post/save-post`, `POST /post/update/:id` | `ap-admin-tooling.int-spec.ts` | AP code-guarded post save/update paths persist graph changes and update projections | Covered |
| AP operational routes | `/post/scrape-posts*`, `/car-details/generate-prompt*`, `/car-details/import*`, `/sitemap/generate`, `/api/v1/orders/send-remind-emails`, `vendor-management/next-to-crawl`, `mark-vendor-for-crawl-next/:id`, `toggle-deleted/:id` | `ap-admin-tooling.int-spec.ts` | scrape status lifecycle, prompt endpoints, prompt import status, sitemap generate, reminders, vendor crawl/toggle flows | Covered |

## Not Covered / Gap Backlog

| Priority | Module | Gap | Why it matters | Proposed scenario | Suggested spec file |
|---|---|---|---|---|---|
| None | - | Current documented P1/P2 backlog is closed | Maintain by adding new gaps when behavior expands | N/A | N/A |

Backlog source references:
- `/Users/reipano/Personal/vehicle-api/docs/modules/legacy-data.md`
- `/Users/reipano/Personal/vehicle-api/docs/modules/legacy-ap.md`
- `/Users/reipano/Personal/vehicle-api/docs/modules/imports.md`
- `/Users/reipano/Personal/vehicle-api/docs/modules/legacy-docs.md`
- `/Users/reipano/Personal/vehicle-api/docs/modules/legacy-admin.md`
- `/Users/reipano/Personal/vehicle-api/docs/modules/legacy-favourites.md`

## Known Constraints
- Integration suite runs against ephemeral MySQL (local Docker or CI service container).
- Fixtures are deterministic and database-reset driven.
- Outbound network is blocked/stubbed in integration setup.
- Legacy-compatible response behavior is intentionally preserved in several endpoints.

## Maintenance Rule
- Any PR that changes integration tests **must** update this document in the same PR.
- Any PR that changes endpoint behavior without integration test updates must explicitly document why.
- Team rule: after each implementation step, immediately update this document before moving to the next step.

Reviewer checklist:
- [ ] New/changed integration scenarios are reflected in the relevant module matrix row.
- [ ] New uncovered behavior is added to the backlog with priority and target spec file.
- [ ] Removed/deprecated tests are reflected by status updates (`Covered` -> `Partially Covered`/`Not Covered`).
- [ ] Claims here map to concrete assertions in `test/integration/*.int-spec.ts`.
