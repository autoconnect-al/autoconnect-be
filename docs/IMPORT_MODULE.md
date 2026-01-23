# Import Module Documentation

## Overview

The import module handles importing posts and car details from various sources (Instagram via Apify, Encar) with direct database persistence, automatic caption processing, optional AI-powered car detail generation, and image downloading capabilities.

## Features

### 1. Direct Database Persistence

Previously, imports were done via HTTP requests. Now, posts are saved directly to the database using Prisma ORM.

**Benefits:**
- Faster import process
- Better error handling
- Transaction support
- Type-safe database operations

### 2. Caption Processing

All captions are automatically processed during import:

#### Cleaned Caption Generation
- Removes emojis and special characters
- Normalizes whitespace
- Preserves meaningful text content

**Example:**
```typescript
Input:  "BMW 3 Series 🚗 Great car! ⭐⭐⭐"
Output: "BMW 3 Series Great car!"
```

#### Base64 Encoding
- Captions are encoded to Base64 before saving to database
- Prevents issues with special characters and encoding

#### Sold Status Detection
- Automatically detects if a post is sold based on keywords
- Keywords: `sold`, `shitur`, `u shit`, `porositur`, `rezervuar`
- Excludes posts containing `per te shitur` (for sale)

**Example:**
```typescript
"BMW 3 Series sold" → isSold = true
"BMW per te shitur" → isSold = false
```

### 3. Source-Specific Handling

#### Instagram Imports (via Apify)
- Creates post with empty `car_detail` by default
- Optionally uses OpenAI to generate car details from caption
- Filters only carousel posts
- Extracts images and metadata

#### Encar Imports
- Creates both post and full `car_detail`
- Includes make, model, variant, price, etc.
- Processes Korean vehicle data
- Calculates pricing with shipping and fees

### 4. OpenAI Integration (Optional)

Automatically generates car details from post captions using GPT-4.

**Enable with query parameter:**
```bash
POST /v1/apify/import?useOpenAI=true&code=ADMIN_CODE
POST /encar/scrape?pages=1&useOpenAI=true&code=ADMIN_CODE
```

**Generated Fields:**
- Make
- Model
- Variant
- Registration Year
- Mileage
- Transmission
- Fuel Type
- Engine Size
- Drivetrain
- Body Type
- Price

**Configuration:**
- Set `OPENAI_API_KEY` in environment variables
- Optionally set `OPENAI_MODEL` (defaults to `gpt-4o-mini`)

### 5. Image Download Service

Generic service for downloading and processing images in multiple formats.

**Output Formats:**
1. **Main Image**: High-quality WebP format
2. **Thumbnail**: Small WebP (300px max)
3. **Metadata**: Small JPEG (150px max) for metadata extraction

**Requirements:**
- Install `sharp` package for image processing: `npm install sharp`
- Set `UPLOAD_DIR` environment variable (defaults to `/tmp/uploads`)

**Usage:**
```typescript
const variants = await imageDownloadService.downloadAndProcessImage(
  imageUrl,
  'post-123456'
);
// Returns: { main: '...', thumbnail: '...', metadata: '...' }
```

## API Endpoints

### Apify Import (Instagram)

**Endpoint:** `POST /v1/apify/import`

**Query Parameters:**
- `code` (required): Admin access code
- `useOpenAI` (optional): Enable AI car detail generation (`true` or `1`)

**Response:**
```json
{
  "ok": true,
  "status": "queued"
}
```

**Process:**
1. Fetches latest dataset from Apify
2. Filters carousel posts
3. Processes captions (clean, encode, detect sold status)
4. Optionally generates car details with OpenAI
5. Saves to database

### Encar Import (Korean Vehicles)

**Endpoint:** `POST /encar/scrape`

**Query Parameters:**
- `pages` (optional): Number of pages to scrape (default: 1)
- `code` (required): Admin access code
- `useOpenAI` (optional): Enable AI car detail generation (`true` or `1`)

**Response:**
```json
{
  "ok": true,
  "pages": 1
}
```

**Process:**
1. Scrapes Encar vehicle listings
2. Extracts car details (make, model, price, etc.)
3. Processes captions
4. Optionally enhances with OpenAI
5. Saves to database

## Admin Access

All import endpoints are protected by the `AdminGuard`.

**Access Methods:**
1. Query parameter: `?code=YOUR_ADMIN_CODE`
2. (Future) JWT authentication with admin role

**Configuration:**
- Set `ADMIN_CODE` in environment variables
- Defaults to: `ejkuU89EcU6LinIHVUvhpQz65gY8DOgG`

## Environment Variables

```bash
# Required for Apify imports
APIFY_API_TOKEN=your_apify_token
APIFY_DATASET_URL=https://api.apify.com/v2/acts/...

# Required for database
DATABASE_URL=mysql://user:password@host:port/database

# Optional for OpenAI integration
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini  # or gpt-4, gpt-3.5-turbo

# Optional for admin access
ADMIN_CODE=your_secure_code

# Optional for image processing
UPLOAD_DIR=/path/to/uploads
```

## Database Schema

### Post Table
- `id`: Unique post identifier
- `caption`: Base64 encoded caption
- `cleanedCaption`: Caption without emojis/formatting
- `sidecarMedias`: JSON array of images
- `car_detail_id`: Link to car_detail record
- `vendor_id`: Link to vendor
- `live`: Published status
- `likesCount`, `viewsCount`: Social metrics

### Car Detail Table
- `id`: Unique car detail identifier
- `make`, `model`, `variant`: Vehicle identification
- `registration`: Year
- `mileage`, `price`: Numeric values
- `transmission`, `fuelType`, `bodyType`: Categories
- `sold`: Detected from caption
- `published`: Approval status
- `contact`: JSON contact information

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test src/modules/imports/utils/caption-processor.spec.ts

# Run with coverage
npm run test:cov
```

### Building

```bash
# Build the project
npm run build

# Run linter
npm run lint

# Format code
npm run format
```

### Adding a New Import Source

1. Create a new controller in `src/modules/imports/[source]-import/`
2. Implement scraping/fetching logic
3. Use `PostImportService` to save to database
4. Add admin guard protection
5. Register in `apify-import.module.ts`

## Example: Complete Import Flow

```typescript
// 1. Fetch data from source
const rawPost = await fetchFromSource();

// 2. Map to internal format
const postData = {
  id: rawPost.id,
  caption: rawPost.text,
  sidecarMedias: rawPost.images,
  origin: 'INSTAGRAM',
  cardDetails: null, // or extract if available
};

// 3. Import to database
const postId = await postImportService.importPost(
  postData,
  vendorId,
  useOpenAI, // optional AI enhancement
);

// Post is now in database with:
// - Cleaned caption
// - Base64 encoded caption
// - Sold status detected
// - Empty or AI-generated car_detail
```

## Troubleshooting

### "Sharp not available" warning
- Install sharp: `npm install sharp`
- Images will be saved without processing if sharp is missing

### "OpenAI API key not configured"
- Add `OPENAI_API_KEY` to environment
- Feature will be skipped without throwing errors

### "Admin access required" error
- Include `?code=YOUR_ADMIN_CODE` in request
- Check `ADMIN_CODE` environment variable

### Database connection errors
- Verify `DATABASE_URL` is correct
- Run `npx prisma generate` to regenerate client
- Check database is accessible

## Future Enhancements

- [ ] Implement proper role-based access control
- [ ] Add image CDN upload integration
- [ ] Batch import status tracking
- [ ] Import history and rollback
- [ ] Webhook notifications on import completion
- [ ] Duplicate detection and merging
- [ ] Advanced AI prompts configuration
- [ ] Multi-language caption support
