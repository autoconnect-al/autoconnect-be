# Bulk Import Module Documentation

## Overview

The Bulk Import module provides CSV-based functionality to help administrators populate and update car details efficiently. This is particularly useful for batch processing posts where car details need to be extracted from captions using AI or manual editing.

## Features

- **CSV Export**: Export posts and car details to CSV format for easy editing
- **Flexible Limits**: Export up to 100 rows at a time, or export all matching records
- **CSV Import**: Upload modified CSV files to update or create car detail records
- **Error Handling**: Comprehensive error reporting for failed rows during import
- **Admin Protection**: All endpoints require admin authentication

## API Endpoints

### 1. Export CSV (Limited)

**GET** `/bulk-import/export?limit=50`

Exports posts and their associated car details as a CSV file. By default, exports 100 rows (maximum).

**Query Parameters:**
- `limit` (optional): Number of rows to export (1-100, default: 100)

**Response:** CSV file download

**Example:**
```bash
curl -X GET "http://localhost:3000/bulk-import/export?limit=50&code=YOUR_ADMIN_CODE" \
  --output posts-export.csv
```

### 2. Export All CSV

**GET** `/bulk-import/export-all`

Exports ALL posts that match the criteria without any limit. Use with caution as this can produce very large files.

**Response:** CSV file download

**Example:**
```bash
curl -X GET "http://localhost:3000/bulk-import/export-all?code=YOUR_ADMIN_CODE" \
  --output posts-export-all.csv
```

### 3. Import CSV

**POST** `/bulk-import/import`

Uploads a CSV file to update existing car details or create new ones.

**Request:**
- Content-Type: `multipart/form-data`
- Body: Form data with `file` field containing the CSV file

**Response:**
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

**Example:**
```bash
curl -X POST "http://localhost:3000/bulk-import/import?code=YOUR_ADMIN_CODE" \
  -F "file=@/path/to/your/posts-export.csv"
```

## CSV Format

The exported CSV contains the following columns:

### Post Columns
- `post_id`: Unique identifier for the post
- `post_origin`: Origin of the post (manual, instagram, etc.)
- `post_revalidate`: Whether the post needs revalidation
- `post_dateCreated`: Post creation date
- `post_caption`: Original caption
- `post_cleanedCaption`: Cleaned/processed caption
- `post_vendor_id`: Vendor ID associated with the post
- `post_car_detail_id`: Car detail ID (if linked)
- `post_status`: Post status

### Car Detail Columns
- `cd_id`: Car detail unique identifier
- `cd_published`: Whether the car detail is published
- `cd_sold`: Whether the car is sold
- `cd_deleted`: Whether the record is deleted
- `cd_make`: Car make (e.g., Toyota)
- `cd_model`: Car model (e.g., Camry)
- `cd_variant`: Car variant
- `cd_registration`: Registration year
- `cd_mileage`: Mileage
- `cd_transmission`: Transmission type
- `cd_fuelType`: Fuel type
- `cd_engineSize`: Engine size
- `cd_drivetrain`: Drivetrain type
- `cd_seats`: Number of seats
- `cd_numberOfDoors`: Number of doors
- `cd_bodyType`: Body type
- `cd_customsPaid`: Whether customs are paid
- `cd_options`: Additional options (JSON string)
- `cd_price`: Price
- `cd_emissionGroup`: Emission group
- `cd_type`: Vehicle type
- `cd_contact`: Contact information (JSON string)
- `cd_priceVerified`: Whether price is verified
- `cd_mileageVerified`: Whether mileage is verified
- `cd_country`: Country
- `cd_city`: City
- `cd_countryOfOriginForVehicles`: Country of origin
- `cd_phoneNumber`: Phone number
- `cd_whatsAppNumber`: WhatsApp number
- `cd_location`: Location

## Workflow

### Typical Use Case

1. **Export Data**: Download posts that need car details populated
   ```bash
   GET /bulk-import/export?limit=100
   ```

2. **Process CSV**: Use AI or manual editing to fill in car details from captions
   - Open the CSV in Excel, Google Sheets, or process with AI
   - Fill in the `cd_*` columns based on information in captions
   - Save the modified CSV

3. **Import Data**: Upload the processed CSV
   ```bash
   POST /bulk-import/import
   ```

4. **Review Results**: Check the import summary for any errors
   ```json
   {
     "success": true,
     "summary": {
       "created": 15,
       "updated": 35,
       "errors": [
         {
           "row": 42,
           "error": "Post with ID 12345 not found"
         }
       ]
     }
   }
   ```

## Query Logic

The export endpoints fetch posts based on the following criteria:
- Post origin is 'manual' or 'instagram'
- Car detail is not published OR is null OR post needs revalidation
- Car detail is not sold OR is null
- Car detail is not deleted OR is null

This ensures you're only working with posts that need attention.

## Authentication

All endpoints require admin authentication via the `AdminGuard`. Currently, this is done by providing the admin code in the query parameter:

```
?code=YOUR_ADMIN_CODE
```

The admin code is configured via the `ADMIN_CODE` environment variable.

## Error Handling

### Import Errors

The import process handles errors gracefully:
- If a row fails, it's logged but doesn't stop the entire import
- Each error includes the row number and error message
- The summary shows total created, updated, and failed records

### Common Errors

1. **Post not found**: The `post_id` doesn't exist in the database
2. **Invalid CSV format**: The CSV file is malformed
3. **Type mismatch**: Data types don't match expected values (e.g., text in a number field)

## Best Practices

1. **Test with small batches**: Start with a small limit (e.g., 10-20 rows) to test your workflow
2. **Backup data**: Always keep a copy of the original export before making changes
3. **Validate data**: Ensure required fields are filled before importing
4. **Check errors**: Review the error summary after each import
5. **Use consistent formats**: Maintain data format consistency (dates, booleans, numbers)

## Technical Notes

- BigInt IDs are automatically converted to strings in CSV for compatibility
- Boolean values can be represented as `true`/`false` or `1`/`0`
- JSON fields (contact, options) are stringified in export and parsed on import
- Null values are exported as empty strings or "null"
- The CSV parser handles quoted values and escaped characters

## Module Structure

```
src/modules/bulk-import/
├── bulk-import.controller.ts       # API endpoints
├── bulk-import.controller.spec.ts  # Controller tests
├── bulk-import.service.ts          # Business logic
├── bulk-import.service.spec.ts     # Service tests
├── bulk-import.module.ts           # Module definition
├── dto/
│   └── export-query.dto.ts         # Query parameter validation
└── types/
    └── bulk-import.types.ts        # TypeScript interfaces
```

## Dependencies

- `csv-parse`: CSV parsing functionality
- `csv-stringify`: CSV generation functionality
- `@nestjs/platform-express`: File upload support
- `multer`: Multipart form data handling

## Future Enhancements

Possible improvements for future versions:
- Support for other file formats (Excel, JSON)
- AI integration for automatic caption processing
- Batch validation before import
- Progress tracking for large imports
- Scheduled exports
- Export filtering options
- Template generation for new posts

