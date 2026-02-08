# Vehicle API - Swagger Documentation Guide

## Overview

The Vehicle API is fully documented using Swagger/OpenAPI 3.0. All endpoints, request/response schemas, and authentication requirements are automatically documented and available through an interactive UI.

## Accessing the Swagger Documentation

### Development Environment

1. Start the application:
   ```bash
   npm run start:dev
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:3000/api-docs
   ```

### Production Environment

After deploying, access the documentation at:
```
https://your-api-domain.com/api-docs
```

## API Structure

The API is organized into the following tags/modules:

### 1. **Health** - System Status
- **GET /api/health** - Check if the API is operational

### 2. **Auth** - Authentication (v1)
Authentication endpoints for user login and password management.

- **POST /api/v1/auth/login**
  - Login with username or email
  - Returns JWT token
  - Rate limited: 5 requests per 60 seconds

- **POST /api/v1/auth/change-password**
  - Change user password
  - Requires JWT authentication
  - Returns success message

- **POST /api/v1/auth/password-reset/request**
  - Request a password reset token
  - Email is sent to the user with reset link

- **POST /api/v1/auth/password-reset/confirm**
  - Confirm and apply password reset using token

### 3. **Search** - Vehicle Search (v1)
Search and filter vehicles with advanced criteria.

- **GET /api/v1/search**
  - Search vehicles with multiple filter options
  - Supports pagination, price/mileage ranges, make/model filtering
  - Query parameters:
    - `make1, model1, variant1` - Primary vehicle search criteria
    - `make2, model2, variant2` - Secondary vehicle search criteria
    - `make3, model3, variant3` - Tertiary vehicle search criteria
    - `priceFrom, priceTo` - Price range filter
    - `mileageFrom, mileageTo` - Mileage range filter
    - `registrationFrom, registrationTo` - Registration year range
    - `transmission` - Filter by transmission type
    - `bodyType` - Filter by body type
    - `fuelType` - Filter by fuel type
    - `emissionGroup` - Filter by emission group
    - `canExchange` - Filter exchangeable vehicles
    - `customsPaid` - Filter vehicles with customs paid
    - `generalSearch` - Free text search
    - `keyword` - Specific keyword search
    - `sortBy` - Sort field (price, mileage, renewedTime, registration)
    - `sortOrder` - Sort order (asc, desc)
    - `page` - Page number (default: 1)
    - `limit` - Items per page (default: 20)

- **GET /api/v1/search/most-wanted**
  - Get most wanted/trending vehicles
  - Query parameters:
    - `type` - Type of most wanted listing
    - `limit` - Number of results to return
    - `excludeIds` - Vehicle IDs to exclude

### 4. **Vendor** - Vendor Management (v1)
CRUD operations for vendor accounts. **All endpoints require admin authorization.**

- **POST /api/v1/vendor**
  - Create a new vendor account
  - Supports profile picture upload (5MB max)
  - Admin only

- **GET /api/v1/vendor**
  - List all vendors
  - Admin only

- **GET /api/v1/vendor/{id}**
  - Get vendor details by ID
  - Admin only

- **PATCH /api/v1/vendor/{id}**
  - Update vendor information
  - Supports profile picture update (5MB max)
  - Admin only

- **DELETE /api/v1/vendor/{id}**
  - Delete a vendor account
  - Admin only

- **POST /api/v1/vendor/{id}/sync-instagram**
  - Synchronize Instagram content for vendor
  - Admin only

## Authentication

The API uses JWT (JSON Web Tokens) for authentication.

### How to Authenticate in Swagger UI

1. Click the **"Authorize"** button in the top-right corner
2. Paste your JWT token in the format: `Bearer <your-token>`
3. All subsequent requests will include the authorization header

### Getting a Token

1. Call the login endpoint:
   ```bash
   POST /api/v1/auth/login
   ```
   
   Request body:
   ```json
   {
     "identifier": "user@example.com",
     "password": "your-password"
   }
   ```

2. The response includes an access token:
   ```json
   {
     "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     "user": {
       "id": "123",
       "email": "user@example.com",
       "name": "John Doe"
     }
   }
   ```

3. Use this token in the Authorization header for subsequent requests

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Login endpoint**: 5 requests per 60 seconds
- **General endpoints**: 10 requests per 60 seconds

## Request/Response Examples

### Example 1: Login

**Request:**
```bash
POST /api/v1/auth/login
Content-Type: application/json

{
  "identifier": "john.doe@example.com",
  "password": "SecurePassword123"
}
```

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "123",
    "email": "john.doe@example.com",
    "name": "John Doe"
  }
}
```

### Example 2: Search Vehicles

**Request:**
```bash
GET /api/v1/search?make1=Toyota&model1=Camry&priceFrom=20000&priceTo=35000&page=1&limit=10
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "vehicle-123",
      "make": "Toyota",
      "model": "Camry",
      "price": 25000,
      "mileage": 45000,
      "registration": 2022
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 150
  }
}
```

### Example 3: Create Vendor

**Request:**
```bash
POST /api/v1/vendor
Content-Type: multipart/form-data
Authorization: Bearer <your-jwt-token>

Form Data:
- accountName: "John Doe Auto Sales"
- biography: "Professional vehicle seller with 10 years of experience"
- phoneNumber: "+1-555-0123"
- city: "New York"
- country: "US"
- profilePicture: <file>
```

**Response (201 Created):**
```json
{
  "id": "vendor-456",
  "accountName": "John Doe Auto Sales",
  "biography": "Professional vehicle seller with 10 years of experience",
  "phoneNumber": "+1-555-0123",
  "city": "New York",
  "country": "US",
  "profilePicturePath": "account_pictures/vendor-1234567890.jpg"
}
```

## Error Responses

### 400 Bad Request
Validation error or invalid input:
```json
{
  "statusCode": 400,
  "message": "Invalid request parameters",
  "error": "Bad Request"
}
```

### 401 Unauthorized
Missing or invalid authentication:
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

### 403 Forbidden
Insufficient permissions:
```json
{
  "statusCode": 403,
  "message": "You don't have permission to access this resource",
  "error": "Forbidden"
}
```

### 404 Not Found
Resource not found:
```json
{
  "statusCode": 404,
  "message": "Resource not found",
  "error": "Not Found"
}
```

### 429 Too Many Requests
Rate limit exceeded:
```json
{
  "statusCode": 429,
  "message": "Too many requests, please try again later",
  "error": "Too Many Requests"
}
```

## Data Types

### Common Data Types Used

- **BigInt**: Large integer values (vehicle IDs, user IDs)
- **DateTime**: ISO 8601 format timestamps
- **File**: Multipart file upload
- **UUID**: Unique identifiers
- **Enum**: Restricted set of values

## Filtering and Sorting

### Filter Examples

**By Make and Model:**
```
/api/v1/search?make1=Honda&model1=Accord
```

**By Price Range:**
```
/api/v1/search?priceFrom=15000&priceTo=40000
```

**By Vehicle Type:**
```
/api/v1/search?bodyType=sedan&transmission=automatic
```

**Combined Filters:**
```
/api/v1/search?make1=Toyota&priceFrom=20000&priceTo=50000&transmission=automatic&fuelType=gasoline
```

### Sorting Examples

**Sort by Price (Ascending):**
```
/api/v1/search?sortBy=price&sortOrder=asc
```

**Sort by Mileage (Descending):**
```
/api/v1/search?sortBy=mileage&sortOrder=desc
```

## Pagination

The API supports cursor-based pagination:

- **page**: Page number (starts at 1, default: 1)
- **limit**: Items per page (default: 20)

Example:
```
/api/v1/search?page=2&limit=50
```

This returns items 51-100 of the search results.

## Post Model Fields

The Post model now includes two new engagement tracking fields:

### New Fields
- **postOpen** (Integer, default: 0)
  - Tracks the number of times a post has been opened/viewed
  - Incremented via the `/api/v1/posts/:postId/increment?metric=postOpen` endpoint

- **impressions** (Integer, default: 0)
  - Tracks the number of impressions/views a post has received
  - Incremented via the `/api/v1/posts/:postId/increment?metric=impressions` endpoint

### Existing Fields
- **id**: Unique identifier (BigInt)
- **dateCreated**: Creation timestamp
- **dateUpdated**: Last update timestamp
- **caption**: Post caption/description
- **likesCount**: Number of likes
- **viewsCount**: Number of views
- **vendor_id**: Associated vendor ID
- **car_detail_id**: Associated car detail ID
- And more...

## File Upload Guidelines

### Vendor Profile Picture

- **Max Size**: 5MB
- **Formats**: JPEG, PNG, GIF, WebP
- **Field Name**: `profilePicture`
- **Upload Location**: `./uploads/account_pictures/`

## Best Practices

1. **Always use HTTPS** in production environments
2. **Store tokens securely** - Never expose JWT tokens in logs or version control
3. **Implement token refresh** - JWT tokens should have reasonable expiration times
4. **Use pagination** - For large result sets, always use pagination
5. **Filter appropriately** - Use filters to reduce response sizes
6. **Handle rate limiting** - Implement exponential backoff for retry logic
7. **Validate input** - Always validate data on the client side before sending
8. **Use meaningful parameters** - Provide filters for better search results

## Troubleshooting

### Common Issues

**Issue**: "401 Unauthorized" error
- **Solution**: Ensure your JWT token is valid and hasn't expired. Get a new token from the login endpoint.

**Issue**: "429 Too Many Requests" error
- **Solution**: You've exceeded the rate limit. Wait before making more requests. Implement exponential backoff.

**Issue**: "400 Bad Request" with validation error
- **Solution**: Check the request body/parameters against the API schema in Swagger UI. Ensure all required fields are present and valid.

**Issue**: "404 Not Found" error
- **Solution**: Verify the endpoint path is correct and the resource ID exists in the database.

## Support

For issues, questions, or feature requests, please refer to:
- **Documentation**: [GitHub Repository](https://github.com/reipano/vehicle-api)
- **Issues**: Submit bug reports on GitHub
- **Email**: support@example.com

## Version History

- **v1.0.0** - Initial API release with core endpoints (Jan 2026)

## Additional Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [Swagger/OpenAPI Documentation](https://swagger.io/specification/)
- [JWT Documentation](https://jwt.io/)

