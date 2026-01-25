# Import Logic Fix Summary

## Problem
The import logic was not persisting the `origin` field (and potentially other fields) when importing posts from various sources (INSTAGRAM, ENCAR, etc.) into the database.

## Root Cause
The `post-import.service.ts` file's `importPost()` method was not including the `origin` field in the Prisma `upsert()` operation for both create and update operations.

## Solution
Updated `/src/modules/imports/services/post-import.service.ts` to include the `origin` field in both create and update operations.

### Changes Made

#### File: `src/modules/imports/services/post-import.service.ts`

**Line 249** (Create operation):
- Added: `origin: postData.origin || null,`

**Line 262** (Update operation):
- Added: `origin: postData.origin || null,`

### Full Context

The updated upsert operation now includes:
```typescript
const post = await this.prisma.post.upsert({
  where: { id: postId },
  create: {
    id: postId,
    dateCreated: now,
    dateUpdated: now,
    caption: encodedCaption,
    cleanedCaption,
    createdTime: postData.createdTime || now.toISOString(),
    sidecarMedias: postData.sidecarMedias
      ? postData.sidecarMedias
      : Prisma.JsonNull,
    vendor_id: BigInt(vendorId),
    live: false,
    likesCount: postData.likesCount || 0,
    viewsCount: postData.viewsCount || 0,
    car_detail_id: carDetailId,
    origin: postData.origin || null,  // ✓ NOW PERSISTED
  },
  update: {
    dateUpdated: now,
    caption: encodedCaption,
    cleanedCaption,
    createdTime: postData.createdTime || now.toISOString(),
    sidecarMedias: postData.sidecarMedias
      ? postData.sidecarMedias
      : Prisma.JsonNull,
    likesCount: postData.likesCount || 0,
    viewsCount: postData.viewsCount || 0,
    car_detail_id: carDetailId,
    origin: postData.origin || null,  // ✓ NOW PERSISTED
  },
});
```

## Verification

### Origin Field Sources
The `origin` field is correctly set by import services:

1. **Apify Import** (`src/modules/imports/apify-import/apify-dataset-import.service.ts`):
   - Sets: `origin: 'INSTAGRAM'`
   - Line ~150: `origin: 'INSTAGRAM',`

2. **Encar Import** (`src/modules/imports/encar-import/save-from-encar.ts`):
   - Sets: `origin: 'ENCAR'`
   - Line ~43: `postData.origin = 'ENCAR';`

3. **Remote Post Saver** (`src/modules/imports/remote-post-saver.service.ts`):
   - Checks origin field for routing decisions
   - Lines ~57-58: Handles non-ENCAR origin data

### Other Fields
All other important fields are being persisted:
- ✓ `caption` (encoded and cleaned)
- ✓ `createdTime`
- ✓ `sidecarMedias` (image data)
- ✓ `vendor_id`
- ✓ `car_detail_id` (links to vehicle details)
- ✓ `likesCount`, `viewsCount`
- ✓ `cleanedCaption`
- ✓ `origin` (source of import - INSTAGRAM, ENCAR, etc.)

### Car Detail Fields
The car detail creation also properly handles fields:
- `make`, `model`, `variant`
- `registration` (year)
- `mileage`, `price`
- `transmission`, `fuelType`, `bodyType`
- `drivetrain`, `seats`, `numberOfDoors`
- `customsPaid`, `contact`, `options`
- `sold`, `published`

## Testing
Build successful with origin field support:
```bash
npm run build
```

## Database Schema
The `post` model in `prisma/schema.prisma` includes:
```prisma
model post {
  // ... other fields ...
  origin String? @db.VarChar(30)
  // ... other fields ...
}
```

## Impact
- Posts imported from Instagram will now have `origin = 'INSTAGRAM'`
- Posts imported from Encar will now have `origin = 'ENCAR'`
- This allows proper filtering and identification of post sources in queries and business logic
- Historical posts may have `NULL` origin values for records created before this fix

