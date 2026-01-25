# Post Import Service - Car Detail Preservation

## Overview

The `PostImportService` handles importing posts with a key principle: **existing car details are always preserved**, regardless of origin (Instagram, Encar, etc.).

## Core Behavior

### Rule: Existing Posts → Preserve Car Details

When importing a post that already exists in the database:
- ✅ Car details are **completely preserved** (no modifications)
- ✅ Only post metadata is updated (caption, likes, views, dates)
- ✅ Works for **all origins** (Instagram, Encar, or any other source)

**Rationale:** Once a user has completed car details, that data should not be overwritten by re-imports. The assumption is that user-completed data is authoritative.

## Scenarios

### Scenario 1: Existing Post (Any Origin)
```typescript
// Whether Instagram, Encar, or other origin
await importPost({
  id: '123456',
  caption: 'Updated caption',
  origin: 'INSTAGRAM',
  cardDetails: { make: 'BMW', price: 50000 } // Ignored!
}, vendorId);

// Result:
// - Post caption: UPDATED
// - Car detail: PRESERVED (unchanged)
```

### Scenario 2: New Instagram Post
```typescript
await importPost({
  id: '789012',
  caption: 'New car listing',
  origin: 'INSTAGRAM'
}, vendorId, useOpenAI: true);

// Result:
// - Post: CREATED
// - Car detail: CREATED (empty or AI-generated if useOpenAI=true)
```

### Scenario 3: New Encar Post
```typescript
await importPost({
  id: '345678',
  caption: 'Encar listing',
  origin: 'ENCAR',
  cardDetails: {
    make: 'BMW',
    model: 'X5',
    price: 45000,
    mileage: 120000
  }
}, vendorId);

// Result:
// - Post: CREATED
// - Car detail: CREATED (populated with Encar data)
```

### Scenario 4: New Post with Other Origin and Card Details
```typescript
await importPost({
  id: '456789',
  caption: 'Listing from API',
  origin: 'CUSTOM_SOURCE',
  cardDetails: { make: 'Audi', model: 'A4' }
}, vendorId);

// Result:
// - Post: CREATED
// - Car detail: CREATED (populated with provided data)
```

## Logic Flow

```
importPost(postData, vendorId, ...)
  ↓
IF post already exists
  → Preserve car_detail (reuse ID)
  → Update only post metadata
  ✓ No car detail modifications
  ↓
ELSE (post is new)
  ↓
  IF origin is 'ENCAR' AND has cardDetails
    → Create car_detail with Encar data
  ↓
  ELSE IF origin is 'INSTAGRAM'
    → Create empty car_detail OR AI-generated car_detail
  ↓
  ELSE IF has cardDetails
    → Create car_detail with provided data
  ↓
  ELSE
    → Create empty car_detail
```

## Method Signature

```typescript
async importPost(
  postData: ImportPostData,
  vendorId: number,
  useOpenAI = false,
  downloadImages = false,
  forceDownloadImages = false,
  forceDownloadImagesDays?: number,
): Promise<bigint | null>
```

## Parameters

- **postData**: Post data (id, caption, origin, cardDetails)
- **vendorId**: Vendor ID
- **useOpenAI**: (Default: false) Generate car details via OpenAI for new Instagram posts
- **downloadImages**: (Default: false) Download media files
- **forceDownloadImages**: (Default: false) Re-download existing images
- **forceDownloadImagesDays**: Force download only for recent posts

## Return Value

- **bigint | null**: Post ID if imported, or null if post >3 months old (marked deleted)

## Related Features

### For Bulk Updates to Car Details

Use the `importResult` method for updating car details from AI-parsed JSON:

```typescript
// After AI processes captions and generates car details
const aiResults = JSON.stringify([
  { id: '123456', make: 'BMW', model: 'X5', price: 45000 },
  { id: '789012', make: 'Audi', model: 'A4', price: 35000 }
]);

await importResult(aiResults);
```

### For CSV Import/Export

Use the bulk import endpoints to export posts, edit in spreadsheet/AI, and import back:
- `GET /bulk-import/export?limit=50` - Export posts for editing
- `POST /bulk-import/import` - Import updated CSV

See [BULK_IMPORT.md](./BULK_IMPORT.md) for details.

## Best Practices

1. **Trust user data**: Once car details are completed, they won't be overwritten
2. **Use bulk import for updates**: Use the CSV workflow to batch-update multiple posts
3. **Use importResult for AI**: Process captions with AI and import results
4. **Monitor reimports**: Re-importing existing posts only updates metadata (safe)

## Key Points Summary

✓ Existing posts **always** preserve car details (any origin)
✓ New Instagram posts create empty or AI-generated car details
✓ New Encar posts create car details with Encar data
✓ New other posts create car details with provided data
✓ Post metadata always updates (caption, views, dates)
✓ No user-completed data is ever accidentally overwritten
✓ Images optionally downloaded based on parameters

