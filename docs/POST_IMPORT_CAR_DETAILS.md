# Post Import Service - Car Detail Handling

## Overview

The `PostImportService` handles importing posts with different strategies depending on the post origin (Instagram, Encar, etc.) and whether the post already exists in the database.

## Car Detail Handling by Scenario

### 1. Existing Instagram Posts
**Behavior:** No changes to car_detail
- When importing an existing Instagram post, the car_detail is **completely preserved** as-is
- All user-completed data in the car_detail remains unchanged
- Only post metadata (caption, likes, views, cleaned caption) may be updated
- The assumption is that any car_detail data has already been completed by the user and should not be overwritten

**Example:**
```typescript
// Existing Instagram post
await importPost({
  id: '123456',
  caption: 'New caption text',
  origin: 'INSTAGRAM'
}, vendorId);

// Result: car_detail remains unchanged, post caption updated
```

### 2. New Instagram Posts (No Existing Post)
**Behavior:** Create new car_detail
- An empty car_detail is created (if not using OpenAI)
- Or, a car_detail with AI-generated details is created (if `useOpenAI: true`)
- User can then fill in the details later via the bulk import CSV feature

**Example:**
```typescript
// New Instagram post
await importPost({
  id: '789012',
  caption: 'New car for sale',
  origin: 'INSTAGRAM'
}, vendorId, useOpenAI: true);

// Result: new post created with AI-generated car_detail (if available)
```

### 3. Encar Posts
**Behavior:** Always create/update car_detail with provided data
- Car details from the Encar API are used to create a new car_detail record
- Encar data is always imported fresh (no preservation of existing data)

**Example:**
```typescript
await importPost({
  id: '345678',
  caption: 'Encar listing',
  origin: 'ENCAR',
  cardDetails: {
    make: 'BMW',
    model: 'X5',
    price: 45000
  }
}, vendorId);

// Result: new/updated car_detail with Encar data
```

### 4. Other Origins with Card Details
**Behavior:** Create/update car_detail with provided data
- Card details provided in the import are used to create a car_detail

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

- **postData**: Post data including id, caption, origin, and optional cardDetails
- **vendorId**: The vendor ID this post belongs to
- **useOpenAI**: (Default: false) Generate car details from caption using OpenAI for new Instagram posts
- **downloadImages**: (Default: false) Download and process sidecar media
- **forceDownloadImages**: (Default: false) Force re-download even if images exist
- **forceDownloadImagesDays**: Force download only for posts within last X days

## Return Value

- **bigint | null**: Post ID if successfully imported, or null if post was too old (>3 months) and marked as deleted

## Car Detail Import vs Post Import Service

This service (`importPost`) is for importing posts from external sources (Instagram, Encar).

For updating car details from AI-parsed results (JSON), use the `importResult` method instead:

```typescript
// Import result from AI parsing of captions
await importResult(jsonString);
```

See [BULK_IMPORT.md](../../docs/BULK_IMPORT.md) for the bulk import CSV feature.

## Key Points

✓ Existing Instagram posts: car_detail is **never modified**
✓ New Instagram posts: create empty or AI-filled car_detail
✓ Encar posts: always create/update with provided data
✓ Post metadata: always updated (caption, likes, views, dates)
✓ Promotion fields: preserved on existing posts
✓ Images: optionally downloaded based on parameters

