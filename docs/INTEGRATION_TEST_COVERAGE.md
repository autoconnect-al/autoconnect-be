# Integration Test Coverage

## Purpose
This document is the authoritative map of **integration test** coverage in `vehicle-api`.

It answers:
- what is tested,
- what is not covered,
- and where coverage gaps still exist, grouped by module and functionality.

## Scope
- Included: `test/integration/*.int-spec.ts`
- Excluded: unit tests, contract suites, performance/load testing.

Last updated: 2026-02-25  
Owner: Backend/API maintainers

## Methodology
Coverage map inputs:
- `/Users/reipano/Personal/vehicle-api/test/integration/auth-and-guards.int-spec.ts`
- `/Users/reipano/Personal/vehicle-api/test/integration/read-search-and-sitemap.int-spec.ts`
- `/Users/reipano/Personal/vehicle-api/test/integration/search-matrix.int-spec.ts`
- `/Users/reipano/Personal/vehicle-api/test/integration/write-and-payments.int-spec.ts`
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
| Result count basic behavior | `POST /car-details/result-count` | `read-search-and-sitemap.int-spec.ts`, `search-matrix.int-spec.ts` | Deterministic count for seeded rows | Covered |
| Result count legacy inflation branches | `POST /car-details/result-count` | `search-matrix.int-spec.ts` | Explicit assertions for `+500`, `+1200`, and boundary (`801`) legacy behavior | Covered |
| Related by filter and by post id | `POST /car-details/related-post-filter`, `GET /car-details/related-post/:id` | `search-matrix.int-spec.ts` | promoted-first, fallback, no-promoted, excluded IDs | Covered |
| Most wanted exclusions + promotion fields | `GET /car-details/most-wanted` | `search-matrix.int-spec.ts` | exclusion params and projection fields | Covered |
| Price calculation basic path | `POST /car-details/price-calculate` | `search-matrix.int-spec.ts` | success envelope + non-empty array for valid terms | Covered |
| Caption/detail endpoints | `GET /car-details/post/:id`, `GET /car-details/post/caption/:id` | `read-search-and-sitemap.int-spec.ts` | success + not-found (`404`), caption normalization and media field behavior | Covered |
| General-search guardrails | `POST /car-details/search` | `search-matrix.int-spec.ts` | >75 char input ignored and 10-token cap behavior asserted | Covered |

### Module: legacy-data
| Functionality | Endpoint(s) | Covered by test(s) | Assertions performed | Status |
|---|---|---|---|---|
| Create post success | `POST /data/create-post` | `write-and-payments.int-spec.ts` | envelope + writes in `post/car_detail/search` | Covered |
| Create post invalid payload | `POST /data/create-post` | `write-and-payments.int-spec.ts` | legacy error envelope + no row writes | Covered |
| Update post success | `POST /data/update-post` | `write-and-payments.int-spec.ts` | updated values propagated to `post/car_detail/search` | Covered |
| Promotion field guardrail on update | `POST /data/update-post` | `write-and-payments.int-spec.ts` | untrusted promotion fields cannot overwrite persisted values | Covered |
| Read makes endpoint | `GET /data/makes` | `read-search-and-sitemap.int-spec.ts` | expected make list and type filtering | Covered |
| Upload image validation/security paths | `POST /data/upload-image` | `data-upload-image.int-spec.ts` | rejects remote URL, local path, unsupported mime, invalid payload, oversized multipart upload | Covered |
| Articles/vendors metadata edge permutations | `/data/article*`, `/data/articles*`, `/data/related/articles*`, `/data/latest/articles*`, `/data/metadata/articles*`, `/data/vendors*` | `read-search-and-sitemap.int-spec.ts` | language filtering, related exclusion, metadata missing-id envelope, vendor hyphenated account/biography normalization, articles/total/latest app/category semantics | Covered |

### Module: legacy-group-b (via legacy-data + legacy-payments endpoints)
| Functionality | Endpoint(s) | Covered by test(s) | Assertions performed | Status |
|---|---|---|---|---|
| Atomic write graph expectations | `POST /data/create-post`, `POST /data/update-post` | `write-and-payments.int-spec.ts` | persisted graph reflects intended mutation state | Partially Covered |
| Promotion update protection (untrusted updates) | `POST /data/update-post` | `write-and-payments.int-spec.ts` | promotion fields preserved against untrusted payload | Covered |
| Capture side effects to post/search | `POST /api/v1/orders/:orderID/capture` | `write-and-payments.int-spec.ts` | `customer_orders` transition + promotion propagation | Covered |
| Idempotent capture behavior | `POST /api/v1/orders/:orderID/capture` | `write-and-payments.int-spec.ts` | repeated capture is stable terminal behavior | Covered |
| Owner mismatch + forbidden path | create/capture flow | `write-and-payments.int-spec.ts` | explicit `403` assertions for mismatched owner email in create and capture | Covered |
| Invalid transition conflict path | capture flow | `write-and-payments.int-spec.ts` | non-`CREATED` status capture returns `409` | Covered |

### Module: legacy-payments
| Functionality | Endpoint(s) | Covered by test(s) | Assertions performed | Status |
|---|---|---|---|---|
| Create order success | `POST /api/v1/orders` | `write-and-payments.int-spec.ts` | `CREATED` status + DB row linkage | Covered |
| Create order missing package | `POST /api/v1/orders` | `write-and-payments.int-spec.ts` | `404` legacy envelope | Covered |
| Capture success | `POST /api/v1/orders/:orderID/capture` | `write-and-payments.int-spec.ts` | `COMPLETED`, capture key, persisted transition | Covered |
| Capture idempotency | `POST /api/v1/orders/:orderID/capture` | `write-and-payments.int-spec.ts` | stable repeated completion | Covered |
| Capture unknown order | `POST /api/v1/orders/:orderID/capture` | `write-and-payments.int-spec.ts` | `404` legacy envelope | Covered |
| Provider failure mapping | order create/capture | `payments-provider-failures.int-spec.ts` | provider create/capture exceptions map to `502` legacy envelope | Covered |
| Webhook signature/negative paths | `POST /api/v1/orders/paypal/webhook` | `payments-provider-failures.int-spec.ts` | invalid signature returns `400` legacy envelope | Covered |

### Module: legacy-auth
| Functionality | Endpoint(s) | Covered by test(s) | Assertions performed | Status |
|---|---|---|---|---|
| Login invalid payload | `POST /authentication/login` | `auth-and-guards.int-spec.ts` | `400` legacy envelope | Covered |
| Login success | `POST /authentication/login` | `auth-and-guards.int-spec.ts` | success envelope + JWT shape | Covered |
| Refresh token without auth | `GET /user/refresh-token` | `auth-and-guards.int-spec.ts` | `401` legacy envelope | Covered |
| Refresh token success | `GET /user/refresh-token` | `auth-and-guards.int-spec.ts` | success envelope + `jwt` returned | Covered |
| Instagram access token negative path | `GET /instagram-sync/get-access-token` | `auth-and-guards.int-spec.ts` | expected legacy failure payload | Covered |
| Rate limiting behavior | login guarded route | `auth-and-guards.int-spec.ts` | repeated login attempts return `429` legacy envelope | Covered |
| Reset/verify/create-user flows | `POST /user/reset-password`, `POST /user/verify-password`, `POST /user/create-user` | `auth-and-guards.int-spec.ts` | success path assertions with persistence checks | Covered |

### Module: legacy-sitemap
| Functionality | Endpoint(s) | Covered by test(s) | Assertions performed | Status |
|---|---|---|---|---|
| Sitemap data happy path | `GET /sitemap/data` | `read-search-and-sitemap.int-spec.ts` | success envelope + URL shape presence | Covered |
| App-specific sitemap route | `GET /sitemap/get-sitemap/:appName` | `sitemap-cache.int-spec.ts` | unknown app empty result + positive content generation for configured app | Covered |
| Cache/TTL/staleness behavior | sitemap cache layer | `sitemap-cache.int-spec.ts` | stale-on-hit before TTL and refresh-after-TTL with new data | Covered |

## Not Covered / Gap Backlog

| Priority | Module | Gap | Why it matters | Proposed scenario | Suggested spec file |
|---|---|---|---|---|---|
| None | - | Current documented P1/P2 backlog is closed | Maintain by adding new gaps when behavior expands | N/A | N/A |

Backlog source references:
- `/Users/reipano/Personal/vehicle-api/docs/modules/legacy-search.md`
- `/Users/reipano/Personal/vehicle-api/docs/modules/legacy-group-b.md`
- `/Users/reipano/Personal/vehicle-api/docs/modules/legacy-payments.md`
- `/Users/reipano/Personal/vehicle-api/docs/modules/legacy-auth.md`
- `/Users/reipano/Personal/vehicle-api/docs/modules/legacy-data.md`
- `/Users/reipano/Personal/vehicle-api/docs/modules/legacy-sitemap.md`

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
