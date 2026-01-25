# Fix: Query Parameter Validation Issue

## Problem

When calling the export endpoints with the admin code:
```
GET /bulk-import/export?limit=50&code=code_here
```

You received this error:
```json
{
    "message": [
        "property code should not exist"
    ],
    "error": "Bad Request",
    "statusCode": 400
}
```

## Root Cause

The `ExportQueryDto` class was configured to validate query parameters, but it only defined the `limit` parameter. When you included `code` in the query string, NestJS's class-validator rejected it as an unknown property.

The `code` parameter is used by the `AdminGuard` for authentication, but it was not explicitly allowed in the DTO.

## Solution

Added the `code` parameter to the `ExportQueryDto` class so it's recognized as a valid query parameter:

```typescript
export class ExportQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 100;

  // Allow code parameter for admin authentication (handled by AdminGuard)
  @IsOptional()
  code?: string;
}
```

## Result

✅ Now you can call the endpoints with the admin code:
```
GET /bulk-import/export?limit=50&code=YOUR_ADMIN_CODE
GET /bulk-import/export-all?code=YOUR_ADMIN_CODE
POST /bulk-import/import?code=YOUR_ADMIN_CODE
```

All endpoints will now properly accept the admin code in the query string and pass validation.

## Testing

- ✅ Build: Successful
- ✅ Tests: All 19 tests passing
- ✅ Compilation: No TypeScript errors

