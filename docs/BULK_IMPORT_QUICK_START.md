# Bulk Import Module - Quick Start

## What is it?

A CSV-based tool to help admins efficiently populate car details from post captions.

## Quick Start

### 1. Export Posts
```bash
curl "http://localhost:3000/bulk-import/export?limit=50&code=ADMIN_CODE" -o posts.csv
```

### 2. Edit the CSV
- Fill in car details (make, model, price, etc.) from the captions
- Can be done manually or with AI assistance

### 3. Import Back
```bash
curl -X POST "http://localhost:3000/bulk-import/import?code=ADMIN_CODE" \
  -F "file=@posts.csv"
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/bulk-import/export?limit=N` | Export up to 100 posts |
| GET | `/bulk-import/export-all` | Export all matching posts |
| POST | `/bulk-import/import` | Import CSV file |

## Environment Variables

```env
ADMIN_CODE=your_secret_admin_code
```

## Key CSV Columns

- **Post info**: `post_id`, `post_caption`, `post_cleanedCaption`
- **Car details**: `cd_make`, `cd_model`, `cd_price`, `cd_mileage`, `cd_transmission`, `cd_fuelType`
- **Status**: `cd_published`, `cd_sold`, `cd_deleted`

## Response Format

```json
{
  "success": true,
  "message": "Bulk import completed successfully",
  "summary": {
    "created": 10,
    "updated": 40,
    "errors": []
  }
}
```

For detailed documentation, see [BULK_IMPORT.md](./BULK_IMPORT.md)

