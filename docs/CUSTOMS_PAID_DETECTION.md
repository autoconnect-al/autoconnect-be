# Customs Paid Detection Implementation

## Overview

This implementation adds automatic detection of customs payment status based on keywords found in post captions. When importing posts (particularly from Instagram via Apify), the system now analyzes the cleaned caption to determine if customs duties have been paid or are not required.

## Changes Made

### 1. New Function: `isCustomsPaid()` 
**File:** `src/modules/imports/utils/caption-processor.ts`

A new utility function that detects customs payment indicators in cleaned captions using Albanian language keywords:

**Keywords detected:**
- `pa dogane` - without customs
- `pa letra` - without letters/documents
- `deri ne durres` - delivered in Durrës (customs cleared)
- `deri ne port` - delivered at port (customs cleared)
- `paguar dogane` - customs paid
- `dogane te paguar` - customs are paid
- `nuk ka dogane` - no customs
- `bie dogane` - customs fallen/passed
- `dogana kaluar` - customs passed
- `dogane lire` - free customs
- `pa pezullim` - without suspension
- `importue` - imported (implies customs cleared)
- `blerje direkte` - direct purchase (customs cleared)
- `deri shtepi` - delivered home (customs cleared)
- `dogane paguara` - customs paid

**Function Signature:**
```typescript
export function isCustomsPaid(cleanedCaption: string | null | undefined): boolean
```

**Characteristics:**
- Case-insensitive matching
- Returns `true` if any keyword is found
- Returns `false` for `null`, `undefined`, or if no keywords match
- Handles edge cases gracefully

### 2. Updated: `apify-dataset-import.service.ts`
**File:** `src/modules/imports/apify-import/apify-dataset-import.service.ts`

**Changes:**
1. Added import of `isCustomsPaid` function
2. Modified `mapInstagramPost()` method to:
   - Generate cleaned caption from the original post caption
   - Check for customs paid indicators using `isCustomsPaid()`
   - Include `customsPaid` boolean in the returned `cardDetails` object

**Code Addition:**
```typescript
// Generate cleaned caption for analysis
const cleanedCaption = generateCleanedCaption(post.caption);

// In the return statement:
cardDetails: {
  customsPaid: isCustomsPaid(cleanedCaption),
}
```

### 3. Comprehensive Tests
**File:** `src/modules/imports/utils/caption-processor.spec.ts`

Added 25 test cases covering:
- All individual keywords
- Case insensitivity
- Edge cases (null/undefined)
- Real-world caption examples
- Negative cases (no customs indicators)

**Test Results:** ✅ All 25 tests passing

## Integration Points

### Flow:
1. **Instagram Data Import** → Apify fetches posts
2. **Post Mapping** → `mapInstagramPost()` processes each post
3. **Caption Analysis** → `isCustomsPaid()` analyzes cleaned caption
4. **Data Storage** → `customsPaid` flag stored in `cardDetails`
5. **Database** → Persisted via Prisma to the `Post` model

### Usage in Post Import Service:
The `customsPaid` value is now included in `ImportPostData.cardDetails` and will be automatically saved to the database when posts are imported.

## Example Scenarios

### Scenario 1: Post with customs cleared
**Caption:** "Makina pa dogane, gjendja perfekte, gata per te punsim"
**Result:** `customsPaid = true`

### Scenario 2: Imported vehicle
**Caption:** "Makina importue nga Gjermania, motorri 2.5, me dokumente"
**Result:** `customsPaid = true`

### Scenario 3: Delivery location indicates customs cleared
**Caption:** "Deri ne durres, dogana kaluar, kerko personi serioz"
**Result:** `customsPaid = true`

### Scenario 4: No customs indicators
**Caption:** "Makina e bukur per shitje, kontakt 06XXXXXXX"
**Result:** `customsPaid = false`

## Maintenance Notes

### Adding New Keywords
To add new customs payment keywords, simply update the `customsPaidKeywords` array in `isCustomsPaid()`:

```typescript
const customsPaidKeywords = [
  'pa dogane',
  'pa letra',
  // ... add new keywords here
];
```

### Testing New Keywords
Add test cases in `caption-processor.spec.ts` to verify new keywords work correctly:

```typescript
it('should detect "new_keyword"', () => {
  expect(isCustomsPaid('new_keyword')).toBe(true);
});
```

## Performance Considerations

- The `isCustomsPaid()` function performs a simple substring search (case-insensitive)
- Time complexity: O(n*m) where n = caption length, m = number of keywords
- Currently minimal impact on performance due to small keyword list and caption lengths

## Future Enhancements

1. **Machine Learning Integration**: Could replace keyword-based detection with ML model for improved accuracy
2. **Language Variations**: Could expand to other Albanian dialects or phonetic variations
3. **Context Analysis**: Could consider surrounding keywords to improve accuracy
4. **Confidence Scoring**: Could return a confidence score instead of boolean
5. **Database Queries**: Could search for posts where `customsPaid` is `false` for future verification

## Validation

✅ All tests passing
✅ Project builds successfully
✅ No TypeScript errors
✅ NestJS conventions followed
✅ Proper error handling implemented

