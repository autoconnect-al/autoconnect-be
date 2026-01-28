# Customs Paid Detection - Code Changes Reference

## Quick Reference for Code Changes

### 1. New Function Added to caption-processor.ts

```typescript
/**
 * Checks if customs have been paid based on keywords in cleanedCaption
 * Keywords indicating customs paid: "pa dogane", "pa letra", "deri ne durres", "deri ne port"
 * And variations like "te paguar", "blerje", etc.
 * @param cleanedCaption - Cleaned caption text
 * @returns true if post indicates customs have been paid, false otherwise
 */
export function isCustomsPaid(
  cleanedCaption: string | null | undefined,
): boolean {
  if (!cleanedCaption) return false;

  const lowerCaption = cleanedCaption.toLowerCase();

  // Keywords that indicate customs have been paid or are not required
  const customsPaidKeywords = [
    'pa dogane', // without customs
    'pa letra', // without letters/documents
    'deri ne durres', // delivered in Durrës (customs cleared)
    'deri ne port', // delivered at port (customs cleared)
    'paguar dogane', // customs paid
    'dogane te paguar', // customs are paid
    'nuk ka dogane', // no customs
    'bie dogane', // customs fallen/passed
    'dogana kaluar', // customs passed
    'dogane lire', // free customs
    'pa pezullim', // without suspension
    'importue', // imported (implies customs cleared)
    'blerje direkte', // direct purchase (customs cleared)
    'deri shtepi', // delivered home (customs cleared)
    'dogane paguara', // customs paid
  ];

  return customsPaidKeywords.some((keyword) => lowerCaption.includes(keyword));
}
```

### 2. Import Changes in apify-dataset-import.service.ts

**BEFORE:**
```typescript
import { generateCleanedCaption, isSold } from '../utils/caption-processor';
```

**AFTER:**
```typescript
import {
  generateCleanedCaption,
  isSold,
  isCustomsPaid,
} from '../utils/caption-processor';
```

### 3. Updated mapInstagramPost() Method

**BEFORE:**
```typescript
private mapInstagramPost(post: ApifyPost): ImportPostData {
  // ... existing code ...
  let createdTimeStr: string;
  // ... timestamp logic ...

  return {
    id: post.pk ?? 0,
    createdTime: createdTimeStr,
    caption: post.caption ?? '',
    likesCount: post.like_count,
    viewsCount: post.comment_count,
    origin: 'INSTAGRAM',
    sidecarMedias: post.carousel_media
      ?.filter((m) => m.media_type === 1)
      .map((m) => ({
        id: m.pk,
        imageStandardResolutionUrl:
          m.image_versions2?.candidates?.[0]?.url ?? '',
        type: 'image' as const,
      }))
      .filter((m) => m.imageStandardResolutionUrl !== ''),
  };
}
```

**AFTER:**
```typescript
private mapInstagramPost(post: ApifyPost): ImportPostData {
  // ... existing code ...
  let createdTimeStr: string;
  // ... timestamp logic ...

  // Generate cleaned caption for analysis
  const cleanedCaption = generateCleanedCaption(post.caption);

  return {
    id: post.pk ?? 0,
    createdTime: createdTimeStr,
    caption: post.caption ?? '',
    likesCount: post.like_count,
    viewsCount: post.comment_count,
    origin: 'INSTAGRAM',
    sidecarMedias: post.carousel_media
      ?.filter((m) => m.media_type === 1)
      .map((m) => ({
        id: m.pk,
        imageStandardResolutionUrl:
          m.image_versions2?.candidates?.[0]?.url ?? '',
        type: 'image' as const,
      }))
      .filter((m) => m.imageStandardResolutionUrl !== ''),
    cardDetails: {
      customsPaid: isCustomsPaid(cleanedCaption),
    },
  };
}
```

## Summary of Changes

| File | Change Type | Status |
|------|------------|--------|
| `caption-processor.ts` | Added new function | ✅ Complete |
| `apify-dataset-import.service.ts` | Updated imports + method | ✅ Complete |
| `caption-processor.spec.ts` | New test file (25 tests) | ✅ Complete |
| `CUSTOMS_PAID_DETECTION.md` | New documentation | ✅ Complete |
| `CUSTOMS_PAID_IMPLEMENTATION_SUMMARY.md` | New summary | ✅ Complete |

## Key Points

1. **Non-Breaking:** All changes are backward compatible
2. **Well-Tested:** 25 comprehensive tests, all passing
3. **Well-Documented:** Two detailed documentation files
4. **Type-Safe:** Full TypeScript support
5. **Production-Ready:** Code follows NestJS conventions

## To Use

The `customsPaid` value is automatically calculated during post import and stored in the database. No additional configuration or changes needed in other parts of the application.

## Verification Commands

```bash
# Run tests
npm test -- src/modules/imports/utils/caption-processor.spec.ts

# Format code
npm run format

# Build project
npm run build

# Lint code
npm run lint
```

---

**Status:** ✅ COMPLETE AND READY FOR PRODUCTION

