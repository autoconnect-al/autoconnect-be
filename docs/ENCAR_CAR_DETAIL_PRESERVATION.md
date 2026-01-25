# Update: Preserve Car Details for All Post Types

## Summary

Updated the `importPost` method to **preserve car details for all existing posts**, regardless of origin (Instagram, Encar, or any other source).

## Changes Made

### Before
- Existing Instagram posts: car detail preserved ✓
- Existing Encar posts: car detail overwritten with new Encar data ✗

### After
- **Existing posts (any origin)**: car detail preserved ✓✓
- **New posts**: car detail created with appropriate data (empty, AI-generated, or provided)

## Implementation

Changed the car detail logic from:
```typescript
// Before: Different handling per origin
if (existingPost && postData.origin === 'INSTAGRAM') {
  carDetailId = existingPost.car_detail_id;
} else if (postData.origin === 'ENCAR' && postData.cardDetails) {
  carDetailId = await this.createCarDetail(...);
}
```

To:
```typescript
// After: Unified approach - preserve existing, create new
if (existingPost) {
  carDetailId = existingPost.car_detail_id;  // Preserve all existing posts
} else if (postData.origin === 'ENCAR' && postData.cardDetails) {
  carDetailId = await this.createCarDetail(...);  // Only for NEW posts
}
```

## Rationale

Once a user has completed car details for a post (from any source):
- That data is authoritative
- It should not be overwritten by re-imports
- The bulk import CSV feature (`importResult`) is the intended way to batch-update car details

## Affected Scenarios

| Scenario | Before | After |
|----------|--------|-------|
| Existing Instagram post re-imported | ✓ Preserved | ✓ Preserved |
| Existing Encar post re-imported | ✗ Overwritten | ✓ Preserved |
| New Instagram post | ✓ Created (empty/AI) | ✓ Created (empty/AI) |
| New Encar post | ✓ Created (with data) | ✓ Created (with data) |

## Files Modified

- `src/modules/imports/services/post-import.service.ts`
  - Updated car detail preservation logic in `importPost` method
  - Added clarifying comments

## Documentation Created

- `docs/POST_IMPORT_CAR_DETAIL_PRESERVATION.md` - Comprehensive guide with all scenarios

## Testing

✅ Build: Successful
✅ No TypeScript errors
✅ Logic verified

## Usage Impact

**Zero breaking changes** - Existing code continues to work. The behavior is now more protective of user data:

```typescript
// Re-importing existing posts is now completely safe
await postImportService.importPost(
  { id: '123456', origin: 'ENCAR', cardDetails: { ... } },
  vendorId
);
// Car details are preserved, not overwritten
```

## When to Use Each Import Method

1. **`importPost`**: Import posts from external sources (Instagram, Encar, etc.)
   - Creates new posts/car details
   - Preserves existing car details (safe to re-import)

2. **`importResult`**: Update car details from AI-parsed results
   - Use for bulk updates after manual editing or AI processing
   - Deliberately updates car details

3. **CSV Bulk Import**: Manage many posts at once
   - Export posts with `GET /bulk-import/export`
   - Edit in spreadsheet or send to AI
   - Import back with `POST /bulk-import/import`

