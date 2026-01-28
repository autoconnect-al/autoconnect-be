# Apify Import Service Fix

## Problem Summary
The Apify import service was not persisting any posts to the database. When running the new NestJS logic, almost no new records were being added, while the old PHP/TypeScript logic was successfully importing ~500 records.

## Root Causes Identified

### 1. **Missing Timestamp Field (PRIMARY ISSUE)**
**Problem**: The `mapInstagramPost` function was mapping `post.date` to `createdTime`, but the Apify dataset response doesn't always have a `date` field.

```typescript
// OLD CODE - BROKEN
createdTime: post.date
  ? (new Date(post.date).getTime() / 1000).toString()
  : '',
```

When `post.date` is `undefined`, the `createdTime` becomes an empty string `''`.

**Impact**: The `isWithinThreeMonths('')` check returns `false` because:
```typescript
export function isWithinThreeMonths(createdTime: string | number | undefined | null): boolean {
  if (!createdTime) return false; // Empty string is falsy!
  // ...
}
```

This caused **ALL new posts to be skipped** with the log message "Skipping post X - older than 3 months".

**Fix**: Updated the mapping to:
1. Try `post.taken_at` first (Unix timestamp in seconds)
2. Try `post.date` second (could be milliseconds or seconds)
3. Fallback to current time if neither exists
4. Added logging when fallback is used

```typescript
// NEW CODE - FIXED
let createdTimeStr: string;
if (post.taken_at) {
  createdTimeStr = post.taken_at.toString();
} else if (post.date) {
  const dateValue = post.date;
  if (dateValue > 10000000000) {
    createdTimeStr = (dateValue / 1000).toString();
  } else {
    createdTimeStr = dateValue.toString();
  }
} else {
  createdTimeStr = Math.floor(Date.now() / 1000).toString();
  console.warn(`Post ${post.pk} has no timestamp field (date/taken_at) - using current time`);
}
```

### 2. **Missing Sold Post Filter**
**Problem**: The PHP logic explicitly skips NEW sold posts:

```php
// PHP CODE
if ($dbPost != null) {
    // Update existing post
    $dbPost = $this->updatePost(...);
} else if (!$isSold) {  // <-- Only create if NOT sold
    $dbPost = $this->createPost(...);
} else {
    $this->logger->info("Post with id: " . $post["id"] . " is sold. Skipping post.");
}
```

The new NestJS code was missing this check and would attempt to create sold posts.

**Fix**: Added sold post detection before calling `importPost`:

```typescript
// Check if post is sold - PHP logic: NEW sold posts are skipped
const postId = BigInt(postData.id);
const existingPost = await this.postImportService['prisma'].post.findUnique({
  where: { id: postId },
  select: { id: true, deleted: true },
});

// If post doesn't exist (new post), check if sold
if (!existingPost || existingPost.deleted) {
  const cleanedCaption = generateCleanedCaption(postData.caption || '');
  const soldStatus = isSold(cleanedCaption);
  
  if (soldStatus) {
    console.log(`Skipping new sold post ${postData.id} - caption indicates sold`);
    return 'skipped:sold';
  }
}
```

### 3. **Data Structure Differences**
The Apify API response structure has evolved over time:
- **Old format**: Used `carousel_media` field
- **New format**: May use `images` field instead
- Field names for timestamps vary: `date`, `taken_at`, or neither

The code now handles missing timestamp fields gracefully by falling back to the current time.

## Files Modified

### `/src/modules/imports/apify-import/apify-dataset-import.service.ts`

1. **Added imports**:
   ```typescript
   import { generateCleanedCaption, isSold } from '../utils/caption-processor';
   ```

2. **Updated `flush()` function**: Added sold post check for new posts

3. **Updated `mapInstagramPost()` function**: Fixed timestamp mapping with fallback logic

## Testing Recommendations

1. **Test with current Apify dataset**: Verify posts are now being created
2. **Check logs**: Look for warnings about missing timestamp fields
3. **Verify sold post filtering**: Ensure new sold posts are skipped but existing sold posts are updated
4. **Monitor import counts**: Should see similar numbers to the old PHP logic (~500 records)

## Comparison with Old Logic

| Aspect | Old PHP/TS Logic | New NestJS Logic (Fixed) |
|--------|------------------|--------------------------|
| Timestamp handling | Used `post.date` directly | Tries `taken_at`, `date`, then fallback to now |
| Sold post handling | Skipped new sold posts | ✅ Now skips new sold posts |
| Date validation | Always had valid timestamp | ✅ Now handles missing timestamps |
| Post creation | Created ~500 records | ✅ Should now match |

## Key Learnings

1. **Always validate data structure assumptions**: The Apify API response format can change
2. **Falsy value checks**: Empty strings are falsy in JavaScript, causing unexpected behavior
3. **Explicit logging**: Added warnings when fallback logic is used for debugging
4. **Match legacy behavior**: When migrating, ensure ALL conditional logic is preserved

## Future Improvements

1. Consider updating Apify actor configuration to ensure consistent field names
2. Add integration tests that mock different Apify response formats
3. Add metrics/monitoring for import success rates
4. Consider making timestamp field preference configurable via environment variables

