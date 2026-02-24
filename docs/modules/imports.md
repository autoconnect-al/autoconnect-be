# Module: imports

## Purpose and Responsibilities
Ingest external listing data, normalize it, and persist updates to local domain tables.

Primary code:
- `/Users/reipano/Personal/vehicle-api/src/modules/imports/apify-import.module.ts`
- `/Users/reipano/Personal/vehicle-api/src/modules/imports/apify-import/*`
- `/Users/reipano/Personal/vehicle-api/src/modules/imports/encar-import/*`
- `/Users/reipano/Personal/vehicle-api/src/modules/imports/services/post-import.service.ts`
- `/Users/reipano/Personal/vehicle-api/src/modules/imports/post.controller.ts`
- `/Users/reipano/Personal/vehicle-api/src/modules/imports/queue/*`

## Public Surface
- Import endpoints (queue/admin guarded):
  - `/import/apify/import`
  - `/encar/scrape`
- Metric increment endpoint:
  - `/imports/posts/:postId/increment` (GET/POST alias)

## Internal Structure
- `ApifyDatasetImportService`: streaming dataset parse + batching
- `PostImportService`: main persistence/idempotency flow
- `ImageDownloadService`: media retrieval/processing
- `OpenAIService`: optional AI details extraction
- Queue services/processors for background execution
- `RemotePostSaverService`: remote AP interoperability path

## End-to-End Flows
1. Controller accepts import trigger.
2. Job is queued (or inline fallback) based on `IMPORT_QUEUE_ENABLED`.
3. Source payload is parsed/mapped to internal shape.
4. `PostImportService.importPost` claims idempotency key and writes `post`/`car_detail`.
5. Optional media download and AI detail enrichment run.
6. Idempotency record marked completed or failed.

## State/Data Mutations
- `post`
- `car_detail`
- `vendor` (ensure existence)
- `import_idempotency`
- metrics fields on `post` (increment path)

## Env Vars Affecting Module
- `IMPORT_QUEUE_ENABLED`
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB`
- `APIFY_DATASET_URL`, `APIFY_API_TOKEN`
- `OPENAI_API_KEY`, `OPENAI_MODEL`
- `UPLOAD_DIR`, `SHOW_LOGS`
- `AUTOCONNECT_BASE_URL`, `AUTOCONNECT_CODE` (remote saver)

## Error and Edge-Case Behavior
- Idempotency prevents duplicate payload side effects.
- Failed idempotency records can be reclaimed and retried.
- Sold/old posts are skipped or marked deleted based on flow branch.
- Image download failures do not block core post persistence.

## Security Controls
- Import trigger endpoints protected with admin guard.
- No query secret auth usage in import routing.
- Upload/media paths sanitized and bounded by size/type checks.

## Observability
- `post-import-service` scoped logs for key branches.
- Queue/inline import status logs.
- Error logs for external dependency failures.

## Recent Changes Implemented
- Local run-state isolation in Apify import service.
- Queue conversion with fallback when Redis not enabled.
- Idempotency claim/complete/fail model.
- Removal of private service internals access (`['prisma']`).

## Known Risks and Limits
- External providers (Apify/OpenAI/remote AP) can fail or throttle.
- Queue mode requires Redis health for durability/retries.

## Ownership and Touchpoints
- Touches `legacy-group-b` metrics path, media utilities, and admin/AP tooling operations.

## Failure Mode Example
- **Symptom**: imports accepted but no new posts.
- **Why**: idempotency already completed for same payload or source fetch failure.
- **Where**: `/Users/reipano/Personal/vehicle-api/src/modules/imports/services/post-import.service.ts` (`claimImportIdempotency`) and `/Users/reipano/Personal/vehicle-api/src/modules/imports/apify-import/apify-dataset-import.service.ts`.
- **Action**: inspect idempotency status + source connectivity in runbooks.

## Related Docs
- `ARCHITECTURE.md`
- `ENVIRONMENT_VARIABLES.md`
- `RUNBOOKS.md`
- `DATA_MODEL_AND_STATE_TRANSITIONS.md`
