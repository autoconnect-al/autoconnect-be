# Vendor Module API Documentation

## Overview
The Vendor Module provides CRUD operations for managing vendor accounts in the admin panel. All endpoints are protected by the AdminGuard and require admin authentication.

## Base URL
All endpoints are prefixed with: `/v1/vendor`

## Authentication
All endpoints require the `ADMIN_CODE` query parameter or JWT authentication with admin role.
Example: `/v1/vendor?code=<ADMIN_CODE>`

## Contact Object Structure
The vendor's contact is a JSON object with the following structure:
```json
{
  "phone_number": "string (optional)",
  "address": "string (optional)",
  "whatsapp": "string (optional)"
}
```

## Endpoints

### 1. Create Vendor
**POST** `/v1/vendor`

Creates a new vendor account with optional profile picture upload.

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Body Parameters:
  - `accountName` (string, optional): Vendor's account name
  - `biography` (string, optional): Vendor's biography
  - `contact` (JSON object, optional): Contact information (see Contact Object Structure)
  - `accountExists` (boolean, optional): Whether the account exists (default: true)
  - `initialised` (boolean, optional): Whether the vendor is initialized
  - `country` (string, optional): Country where vendor operates
  - `city` (string, optional): City where vendor operates
  - `countryOfOriginForVehicles` (string, optional): Country where vehicles originate (e.g., Korea for Korean cars sold in Albania)
  - `phoneNumber` (string, optional): Vendor's phone number
  - `whatsAppNumber` (string, optional): Vendor's WhatsApp number (should use variant with prefix)
  - `location` (string, optional): Google Maps URL for vendor location
  - `useDetailsForPosts` (boolean, optional): When true, vendor details will be synced to all car_details (default: false)
  - `profilePicture` (file, optional): Profile picture image (max 5MB)

**Response:**
```json
{
  "id": "1234567890123",
  "accountName": "Example Vendor",
  "biography": "Sample biography",
  "contact": { 
    "phone_number": "123456789",
    "address": "123 Main St",
    "whatsapp": "+355123456789"
  },
  "country": "Albania",
  "city": "Tirana",
  "countryOfOriginForVehicles": "Korea",
  "phoneNumber": "+355123456",
  "whatsAppNumber": "+355123456",
  "location": "https://maps.google.com/...",
  "useDetailsForPosts": false,
  "profilePicture": "account_pictures/vendor-1234567890-123456789.jpg",
  "accountExists": true,
  "initialised": false,
  "deleted": false,
  "dateCreated": "2024-01-23T12:00:00.000Z",
  "dateUpdated": "2024-01-23T12:00:00.000Z"
}
```

### 2. Get All Vendors
**GET** `/v1/vendor`

Retrieves all non-deleted vendors. **NOT paginated** - returns complete list.

**Request:**
- Method: GET
- No additional parameters required

**Response:**
```json
[
  {
    "id": "1234567890123",
    "accountName": "Vendor 1",
    "biography": "Bio 1",
    "contact": null,
    "profilePicture": null,
    "accountExists": true,
    "initialised": false,
    "deleted": false,
    "dateCreated": "2024-01-23T12:00:00.000Z",
    "dateUpdated": "2024-01-23T12:00:00.000Z"
  },
  {
    "id": "1234567890124",
    "accountName": "Vendor 2",
    ...
  }
]
```

### 3. Get Single Vendor
**GET** `/v1/vendor/:id`

Retrieves a specific vendor by ID.

**Request:**
- Method: GET
- URL Parameters:
  - `id` (string, required): Vendor ID

**Response:**
```json
{
  "id": "1234567890123",
  "accountName": "Example Vendor",
  "biography": "Sample biography",
  "contact": { "email": "vendor@example.com" },
  "profilePicture": "account_pictures/vendor-1234567890-123456789.jpg",
  "accountExists": true,
  "initialised": false,
  "deleted": false,
  "dateCreated": "2024-01-23T12:00:00.000Z",
  "dateUpdated": "2024-01-23T12:00:00.000Z"
}
```

**Error Responses:**
- 404 Not Found: If vendor doesn't exist or is deleted

### 4. Update Vendor
**PATCH** `/v1/vendor/:id`

Updates an existing vendor with optional profile picture upload.

**Request:**
- Method: PATCH
- Content-Type: multipart/form-data
- URL Parameters:
  - `id` (string, required): Vendor ID
- Body Parameters (all optional):
  - `accountName` (string): Updated account name
  - `biography` (string): Updated biography
  - `contact` (JSON object): Updated contact information
  - `accountExists` (boolean): Updated account existence status
  - `initialised` (boolean): Updated initialization status
  - `country` (string): Updated country
  - `city` (string): Updated city
  - `countryOfOriginForVehicles` (string): Updated country of origin for vehicles
  - `phoneNumber` (string): Updated phone number
  - `whatsAppNumber` (string): Updated WhatsApp number
  - `location` (string): Updated location (Google Maps URL)
  - `useDetailsForPosts` (boolean): When set to true, vendor details will be synced to all associated car_details
  - `profilePicture` (file): New profile picture (max 5MB)

**Note:** When `useDetailsForPosts` is set to `true`, the system will automatically update all car_details associated with this vendor's posts with the vendor's location information (country, city, countryOfOriginForVehicles, phoneNumber, whatsAppNumber, location).

**Response:**
```json
{
  "id": "1234567890123",
  "accountName": "Updated Vendor Name",
  "biography": "Updated biography",
  "contact": { 
    "phone_number": "123456789",
    "address": "123 Main St"
  },
  "country": "Albania",
  "city": "Tirana",
  "countryOfOriginForVehicles": "Korea",
  "phoneNumber": "+355123456",
  "whatsAppNumber": "+355123456",
  "location": "https://maps.google.com/...",
  "useDetailsForPosts": true,
  "profilePicture": "account_pictures/vendor-1234567890-987654321.jpg",
  "accountExists": true,
  "initialised": true,
  "deleted": false,
  "dateCreated": "2024-01-23T12:00:00.000Z",
  "dateUpdated": "2024-01-23T13:00:00.000Z"
}
```

**Error Responses:**
- 404 Not Found: If vendor doesn't exist or is deleted

### 5. Delete Vendor (Soft Delete)
**DELETE** `/v1/vendor/:id`

Soft deletes a vendor and cascades the deletion to all related posts.

**Request:**
- Method: DELETE
- URL Parameters:
  - `id` (string, required): Vendor ID

**Response:**
```json
{
  "message": "Vendor and related posts deleted successfully"
}
```

**Error Responses:**
- 404 Not Found: If vendor doesn't exist or is already deleted

### 6. Sync Vendor Details from Instagram
**POST** `/v1/vendor/:id/sync-instagram`

Automatically fetches vendor profile picture from Instagram public API and updates the vendor record.

**Request:**
- Method: POST
- URL Parameters:
  - `id` (string, required): Vendor ID

**Response (Success):**
```json
{
  "success": true,
  "message": "Profile picture synced from Instagram successfully",
  "vendor": {
    "id": "1234567890123",
    "accountName": "example_vendor",
    "profilePicture": "https://instagram.com/.../profile_pic.jpg",
    ...
  }
}
```

**Response (Failure):**
```json
{
  "success": false,
  "message": "Failed to sync from Instagram: <error details>"
}
```

**Error Responses:**
- 404 Not Found: If vendor doesn't exist or doesn't have an Instagram account name

**Note:** This endpoint attempts to fetch the profile picture from Instagram's public API. Instagram's API structure may change, so success is not guaranteed. The vendor must have an `accountName` set.

## File Upload Details

### Profile Picture Upload
- **Storage Location**: `UPLOAD_DIR/account_pictures`
- **File Size Limit**: 5MB
- **Supported Formats**: Any image format (validated by file extension)
- **Filename Pattern**: `vendor-{timestamp}-{random}.{ext}`
- **Storage**: Files are stored on disk, path is saved in database as relative path

### Environment Variables
- `UPLOAD_DIR`: Base directory for uploads (default: `./uploads`)
- `ADMIN_CODE`: Code required for admin authentication

## Soft Delete Behavior

When a vendor is deleted:
1. The vendor's `deleted` field is set to `true`
2. The vendor's `dateUpdated` is updated to current timestamp
3. **All related posts** are also soft deleted (their `deleted` field is set to `true`)
4. Soft-deleted vendors are automatically excluded from:
   - `GET /v1/vendor` (list all)
   - `GET /v1/vendor/:id` (get single - returns 404)

## useDetailsForPosts Feature

When `useDetailsForPosts` is set to `true` on a vendor:

1. **Automatic Sync**: Any updates to the vendor's location details will automatically propagate to all associated car_details
2. **Synced Fields**:
   - `country`
   - `city`
   - `countryOfOriginForVehicles`
   - `phoneNumber`
   - `whatsAppNumber`
   - `location`
3. **Use Case**: Useful when a vendor operates in Albania but imports cars from Korea - you can set the vendor's location once and have it automatically apply to all their vehicle listings
4. **Trigger**: The sync happens automatically when you update a vendor that has `useDetailsForPosts: true`

## Implementation Details

### Technologies Used
- **Framework**: NestJS
- **Database**: Prisma ORM with MySQL/MariaDB
- **File Upload**: Multer with disk storage
- **Authentication**: AdminGuard (query param or JWT)

### Module Structure
```
src/modules/vendor/
├── dto/
│   ├── create-vendor.dto.ts    # DTO for creating vendors
│   └── update-vendor.dto.ts    # DTO for updating vendors
├── vendor.controller.ts        # REST API endpoints
├── vendor.service.ts           # Business logic
├── vendor.module.ts            # Module definition
├── vendor.controller.spec.ts   # Controller tests
└── vendor.service.spec.ts      # Service tests
```

### Database Schema
The vendor entity has been updated in the Prisma schema with the following structure:
```prisma
model vendor {
  id                          BigInt    @id @db.UnsignedBigInt
  dateCreated                 DateTime  @db.DateTime(0)
  dateUpdated                 DateTime? @db.DateTime(0)
  deleted                     Boolean   @default(false)
  contact                     Json?     // {phone_number?: string, address?: string, whatsapp?: string}
  accountName                 String?   @db.VarChar(100)
  profilePicture              String?   @db.LongText
  accountExists               Boolean   @default(true)
  initialised                 Boolean?
  biography                   String?   @db.VarChar(255)
  country                     String?   @db.VarChar(100)
  city                        String?   @db.VarChar(100)
  countryOfOriginForVehicles  String?   @db.VarChar(100)
  phoneNumber                 String?   @db.VarChar(50)
  whatsAppNumber              String?   @db.VarChar(50)
  location                    String?   @db.VarChar(500)
  useDetailsForPosts          Boolean   @default(false)
  post                        post[]
}
```

The car_detail entity has been updated to include vendor location fields:
```prisma
model car_detail {
  // ... existing fields ...
  country                     String?   @db.VarChar(100)
  city                        String?   @db.VarChar(100)
  countryOfOriginForVehicles  String?   @db.VarChar(100)
  phoneNumber                 String?   @db.VarChar(50)
  whatsAppNumber              String?   @db.VarChar(50)
  location                    String?   @db.VarChar(500)
  // ... rest of fields ...
}
```

### Migration
A database migration script has been created at:
`prisma/migrations/20260123204957_add_vendor_and_car_detail_fields/migration.sql`

This migration adds the new fields to both vendor and car_detail tables.

## Testing

### Unit Tests
The module includes comprehensive unit tests:
- **Service Tests**: 66 tests covering all CRUD operations
- **Controller Tests**: Tests for all endpoints
- All tests pass successfully

### Running Tests
```bash
npm test
```

### Test Coverage
- Create vendor with and without profile picture
- List all non-deleted vendors
- Get single vendor by ID
- Update vendor with and without profile picture
- Soft delete vendor and cascade to posts
- Error handling for non-existent vendors

## Security Considerations

1. **Admin-Only Access**: All endpoints protected by AdminGuard
2. **File Upload Limits**: 5MB max file size to prevent abuse
3. **Soft Delete**: Data is preserved for audit purposes
4. **Input Validation**: DTOs use class-validator for input validation
5. **SQL Injection Protection**: Prisma ORM provides parameterized queries

## Notes

- Vendor IDs are generated using `BigInt(Date.now())` for uniqueness
- The read endpoint is **not paginated** as expected vendor count is 100-200
- Profile pictures are stored as relative paths from UPLOAD_DIR
- Soft-deleted vendors and posts remain in the database but are excluded from queries
