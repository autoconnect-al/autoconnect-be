# Swagger Quick Start Guide

## 🚀 Getting Started

### 1. Start the API Server
```bash
npm run start:dev
```

### 2. Open Swagger UI
Navigate to your browser:
```
http://localhost:3000/api-docs
```

## 🔑 Authentication

### Step 1: Get Your JWT Token
1. Scroll down to the **Auth** section
2. Click on **POST /api/v1/auth/login**
3. Click **"Try it out"**
4. Enter credentials:
   ```json
   {
     "identifier": "your-email@example.com",
     "password": "your-password"
   }
   ```
5. Click **"Execute"**
6. Copy the `access_token` from the response

### Step 2: Authorize in Swagger
1. Click the **"Authorize"** button (top-right)
2. Paste your token in the format:
   ```
   Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
3. Click **"Authorize"**
4. Close the dialog

Now all protected endpoints will automatically include your token!

## 📚 API Organization

### Health (Public)
- `GET /api/health` - Check API status

### Auth (Mostly Public)
- `POST /api/v1/auth/login` - Get JWT token
- `POST /api/v1/auth/change-password` - Change password (requires auth)
- `POST /api/v1/auth/password-reset/request` - Request password reset
- `POST /api/v1/auth/password-reset/confirm` - Confirm password reset

### Search (Public)
- `GET /api/v1/search` - Search vehicles with filters
- `GET /api/v1/search/most-wanted` - Get trending vehicles

### Vendor (Admin Only)
- `POST /api/v1/vendor` - Create vendor
- `GET /api/v1/vendor` - List all vendors
- `GET /api/v1/vendor/{id}` - Get vendor details
- `PATCH /api/v1/vendor/{id}` - Update vendor
- `DELETE /api/v1/vendor/{id}` - Delete vendor
- `POST /api/v1/vendor/{id}/sync-instagram` - Sync Instagram

## 💡 Common Tasks

### Search Vehicles by Make and Model
1. Open **GET /api/v1/search**
2. Click **"Try it out"**
3. Set query parameters:
   - `make1`: Toyota
   - `model1`: Camry
   - `page`: 1
   - `limit`: 10
4. Click **"Execute"**

### Search with Price Range
Add these parameters:
- `priceFrom`: 20000
- `priceTo`: 40000

### Search with Multiple Filters
```
make1: Honda
model1: Accord
transmission: automatic
fuelType: gasoline
priceFrom: 15000
priceTo: 35000
```

### Create a New Vendor
1. **Authorize** first (see Authentication section)
2. Open **POST /api/v1/vendor**
3. Click **"Try it out"**
4. Fill in the form:
   - accountName: "John's Auto Sales"
   - city: "New York"
   - phoneNumber: "+1-555-0123"
   - profilePicture: (select an image file)
5. Click **"Execute"**

### Update Vendor
1. **Authorize** first
2. Open **PATCH /api/v1/vendor/{id}**
3. Replace `{id}` with vendor ID
4. Click **"Try it out"**
5. Update fields as needed
6. Click **"Execute"**

## 🔍 Search Filter Options

### By Vehicle Type
```
bodyType: sedan | suv | truck | coupe | hatchback
```

### By Transmission
```
transmission: automatic | manual
```

### By Fuel Type
```
fuelType: gasoline | diesel | hybrid | electric
```

### By Price
```
priceFrom: 10000
priceTo: 50000
```

### By Mileage
```
mileageFrom: 0
mileageTo: 100000
```

### By Registration Year
```
registrationFrom: 2015
registrationTo: 2024
```

### By Availability
```
canExchange: true       # Can exchange
customsPaid: true       # Customs already paid
```

## 📊 Pagination

All list endpoints support pagination:

```
page: 1         # Page number (starts at 1)
limit: 20       # Items per page (default: 20)
```

Example: Get items 21-40
```
page: 2
limit: 20
```

## 🔄 Sorting

Available sort fields:
- `price` - Sort by price
- `mileage` - Sort by mileage
- `renewedTime` - Sort by when listing was renewed
- `registration` - Sort by registration year

Sort order:
- `asc` - Ascending (low to high)
- `desc` - Descending (high to low)

Example:
```
sortBy: price
sortOrder: asc
```

## ⚠️ Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Request successful |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Check request parameters |
| 401 | Unauthorized | Login and get new token |
| 403 | Forbidden | No permission for this action |
| 404 | Not Found | Resource doesn't exist |
| 429 | Too Many Requests | Wait before retrying |

## 🎯 Testing Tips

1. **Always check the schema** - Click the schema section to see expected data types
2. **Use examples** - Swagger shows example values for each field
3. **Try it out first** - Test endpoints in Swagger before integrating
4. **Check responses** - Read the response body to understand the data structure
5. **View error details** - Errors include helpful messages about what went wrong

## 📋 File Upload

When uploading files (like vendor profile pictures):
1. The field will show as "multipart/form-data"
2. Click **"Choose File"** to select an image
3. Max file size: **5MB**
4. Supported formats: JPEG, PNG, GIF, WebP

## 🚨 Rate Limiting

The API limits requests to prevent abuse:

- **Login endpoint**: 5 requests per 60 seconds
- **General endpoints**: 10 requests per 60 seconds

If you get a 429 error, wait a minute before retrying.

## 🔐 Security Best Practices

1. **Never share your token** - Keep JWT tokens secret
2. **Use HTTPS** - Always use HTTPS in production
3. **Store tokens securely** - Don't store in localStorage if not needed
4. **Token expiration** - Tokens expire, get new ones when needed
5. **Change passwords regularly** - Use the change-password endpoint

## 📞 Debugging

### Token Expired?
- Get a new token using the login endpoint
- Update the Authorization header

### 401 Unauthorized?
- Check if you're authorized (click Authorize button)
- Verify your token is valid
- Get a new token if needed

### 400 Bad Request?
- Check the error message for field details
- Verify all required fields are present
- Ensure data types match (e.g., numbers vs strings)

### 404 Not Found?
- Verify the resource ID is correct
- Check if the resource has been deleted
- Try listing to find valid IDs

### 429 Too Many Requests?
- You've hit the rate limit
- Wait 60 seconds before retrying
- Implement retry logic with backoff

## 📖 Learn More

- **Full Documentation**: See `SWAGGER_DOCUMENTATION.md`
- **Implementation Details**: See `SWAGGER_SETUP_SUMMARY.md`
- **NestJS Docs**: https://docs.nestjs.com/
- **Swagger/OpenAPI**: https://swagger.io/

## 💬 Examples

### Example 1: Login and Search
```bash
# 1. Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"user@example.com","password":"password123"}'

# Response: {"access_token":"eyJ...", "user":{...}}

# 2. Search vehicles (with token)
curl http://localhost:3000/api/v1/search?make1=Toyota&priceFrom=20000 \
  -H "Authorization: Bearer eyJ..."
```

### Example 2: Create Vendor
```bash
curl -X POST http://localhost:3000/api/v1/vendor \
  -H "Authorization: Bearer eyJ..." \
  -F "accountName=John's Auto" \
  -F "city=New York" \
  -F "phoneNumber=+1-555-0123" \
  -F "profilePicture=@/path/to/image.jpg"
```

## ✅ Next Steps

1. Open Swagger UI: `http://localhost:3000/api-docs`
2. Get your JWT token using login
3. Click Authorize and paste your token
4. Start testing endpoints!

---

**Happy testing! 🎉**

For questions or issues, refer to the full documentation or check the error messages in Swagger.

