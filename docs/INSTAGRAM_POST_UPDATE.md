# Update: Instagram Post Car Detail Preservation

## Summary

Updated the `importPost` method in `PostImportService` to **preserve all car_detail data for existing Instagram posts**.

## Changes Made

### Before
- Existing Instagram posts would have their car details potentially overwritten or modified

### After  
- **Existing Instagram posts**: car_detail is completely preserved as-is
  - All user-completed data remains unchanged
  - Only post metadata (caption, likes, views) is updated
  
- **New Instagram posts**: empty or AI-generated car_detail is created
  - User can fill in details later via bulk import CSV feature

- **Encar posts**: car_detail is created/updated with provided data (unchanged behavior)

## Logic Flow

```
importPost(postData, vendorId, ...)
  ↓
IF post exists AND origin is 'INSTAGRAM'
  → Preserve existing car_detail (reuse ID)
  ✓ No modifications to car_detail
  ✓ Only update post metadata
  ↓
ELSE IF origin is 'ENCAR' AND has cardDetails
  → Create/update car_detail with Encar data
  ↓
ELSE IF origin is 'INSTAGRAM' AND post is NEW
  → Create empty car_detail OR AI-generated car_detail
  ↓
ELSE IF has cardDetails
  → Create car_detail with provided data
```

## Rationale

The assumption is that once a user has completed car details for an Instagram post, that data should be preserved and not overwritten. The bulk import CSV feature (`importResult` method) is the intended way to update car details in bulk after manual editing or AI processing.

## Files Updated

- `src/modules/imports/services/post-import.service.ts`
  - Updated car detail handling logic in `importPost` method
  - Added clear comments explaining behavior for each scenario

## Documentation

- Created `docs/POST_IMPORT_CAR_DETAILS.md` with:
  - Car detail handling by scenario
  - Method signature and parameters
  - Return values
  - Key points and best practices

## Testing

✅ Project builds successfully
✅ All existing functionality preserved
✅ Logic properly handles all import scenarios

## Usage Example

```typescript
// Existing Instagram post - car_detail is preserved
await postImportService.importPost({
  id: '123456',
  caption: 'Updated caption',
  origin: 'INSTAGRAM'
}, vendorId);
// Result: post caption updated, car_detail unchanged

// New Instagram post - create car_detail
await postImportService.importPost({
  id: '789012',
  caption: 'New listing',
  origin: 'INSTAGRAM'
}, vendorId, useOpenAI: true);
// Result: post + new car_detail created (empty or AI-filled)

// Encar post - create/update car_detail
await postImportService.importPost({
  id: '345678',
  caption: 'Encar listing',
  origin: 'ENCAR',
  cardDetails: { make: 'BMW', model: 'X5', price: 45000 }
}, vendorId);
// Result: post + car_detail created/updated with Encar data
```

## Next Steps

No additional configuration needed. The feature is ready to use.

For bulk updates to car details, use the `importResult` method or the bulk import CSV endpoints:
- `GET /bulk-import/export` - Export posts for editing
- `POST /bulk-import/import` - Import updated CSV

