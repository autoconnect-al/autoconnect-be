# Module: legacy-data

## Purpose and Responsibilities
Serve public catalog/content endpoints and post-mutation endpoints consumed by legacy clients.

Primary code:
- `/Users/reipano/Personal/vehicle-api/src/modules/legacy-data/legacy-data.controller.ts`
- `/Users/reipano/Personal/vehicle-api/src/modules/legacy-data/legacy-data.service.ts`
- `/Users/reipano/Personal/vehicle-api/src/modules/legacy-data/local-media.service.ts`
- `/Users/reipano/Personal/vehicle-api/src/modules/legacy-data/dto/*`

## Public Surface
Base route: `/data`
- read endpoints (makes/models/vendors/articles/metadata)
- mutation endpoints:
  - `POST /create-post`
  - `POST /update-post`
  - `POST /create-user-post`
  - `POST /upload-image`

## Internal Structure
- `LegacyDataService`: read/query logic for metadata/articles/vendor details
- `LocalPostOrderService` dependency for write endpoints
- `LocalMediaService` for upload-image handling
- DTO validation for mutation payloads

## End-to-End Flows
1. Read endpoints map params -> service queries.
2. Mutation endpoints validate DTO payloads.
3. Optional JWT email is extracted via decorator.
4. Post operations delegated to `LocalPostOrderService`.
5. Upload-image normalizes payload and writes converted media file.

## State/Data Mutations
- via delegated write path:
  - `post`, `car_detail`, `search`
- media files under configured media root/tmp

## Env Vars Affecting Module
- `MEDIA_ROOT`
- `BASE_URL` (article URL contexts)

## Error and Edge-Case Behavior
- DTO validation rejects invalid mutation payload shape.
- Invalid JWT token in optional auth header path -> 401.
- Upload-image rejects unsupported source/size/type.

## Security Controls
- SSRF/LFI-safe upload handling (no arbitrary URL/local path reads).
- Mutation payload validation using class-validator DTOs.

## Observability
- `local-media-service` logs upload input shape and conversion outcomes.

## Recent Changes Implemented
- Nondeterministic article query fix.
- Language filtering alignment.
- Upload-image hardening.
- DTO validation added for all data mutation endpoints.

## Known Risks and Limits
- Legacy response envelope remains for compatibility; not fully REST-native.

## Ownership and Touchpoints
- Reads from content/search-related tables.
- Delegates writes to `legacy-group-b` service.

## Failure Mode Example
- **Symptom**: upload-image returns 400 for seemingly valid input.
- **Why**: input is remote URL or invalid/non-base64 payload.
- **Where**: `/Users/reipano/Personal/vehicle-api/src/modules/legacy-data/local-media.service.ts` (`readSourceBuffer`).
- **Action**: send multipart file or valid `data:image/...;base64,...` payload.

## Related Docs
- `modules/legacy-group-b.md`
- `ENVIRONMENT_VARIABLES.md`
