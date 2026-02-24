# FE Strict Parity Checks (Points 1-12)

Run:

```bash
npm run verify:fe:strict
```

Report output:

- `test/contracts/fe-strict-report.json`

Implemented scope:

1. Search success strict parity (`/car-details/search`) with multiple representative car/motorcycle filter combinations and result-id order checks.
2. Result-count strict parity (`/car-details/result-count`) for representative filters.
3. Models `full=true` strict parity:
   - `/data/models/{make}?full=true`
   - `/data/models/motorcycles/{make}?full=true`
4. Related-post strict query variants:
   - `/car-details/related-post/{id}?type=...&excludedIds=...`
   - `/car-details/related-post-filter?type=...&excludedIds=...`
5. Refresh-token success parity (`/user/refresh-token`) with valid `X-Http-Authorization` JWT.
6. Signup success + duplicate parity (`/user/create-user`).
7. Favourites get success parity (`/favourites/get?favourites=...`).
8. Vendor success parity:
   - `/data/vendors/{name}`
   - `/data/vendors/biography/{name}`
9. Most-wanted query variant parity (`/car-details/most-wanted?...`).
10. Admin authorized success suite + DB side-effects:
    - `/admin/user` GET/POST
    - `/admin/user/change-password`
    - `/admin/vendor/contact`
    - `/admin/vendor/biography`
    - `/admin/vendor/profile-picture`
    - `/admin/posts`
    - `/admin/posts/{id}`
    - `/admin/posts/sold/{id}` with DB assertion
    - `/admin/posts/delete/{id}` with DB assertion
11. Price calculate success strict parity:
    - `/car-details/price-calculate` (dynamic filter seeded from live DB row)
12. Post caption success strict parity:
    - `/car-details/post/caption/{id}` (id selected dynamically from live DB row)
- The script exits with non-zero status when any strict parity check fails.
