# Post Metrics Endpoint - Usage Guide

## Quick Reference

### Endpoint URL
```
POST /api/v1/posts/:postId/increment?metric=<postOpen|impressions>
```

### Rate Limit
- **Limit**: 1000 requests per 60 seconds
- **Per IP**: Applied per client IP address
- **Response**: 429 Too Many Requests if exceeded

### Authentication
- **Required**: No
- **Public**: Yes
- **Headers**: None required

---

## Usage Examples

### 1. Increment Post Opens
Track when a post is opened/viewed

**Request**:
```bash
curl -X POST "http://localhost:3000/api/v1/posts/123456789/increment?metric=postOpen"
```

**cURL with verbose**:
```bash
curl -X POST "http://localhost:3000/api/v1/posts/123456789/increment?metric=postOpen" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n"
```

**JavaScript/Fetch**:
```javascript
fetch('http://localhost:3000/api/v1/posts/123456789/increment?metric=postOpen', {
  method: 'POST'
})
.then(response => response.json())
.then(data => console.log('Success:', data))
.catch(error => console.error('Error:', error));
```

**Python**:
```python
import requests

response = requests.post(
    'http://localhost:3000/api/v1/posts/123456789/increment',
    params={'metric': 'postOpen'}
)
print(response.status_code)  # 202
print(response.json())  # {'ok': True, 'status': 'queued'}
```

---

### 2. Increment Impressions
Track impressions/views of a post

**Request**:
```bash
curl -X POST "http://localhost:3000/api/v1/posts/123456789/increment?metric=impressions"
```

**JavaScript**:
```javascript
fetch('http://localhost:3000/api/v1/posts/123456789/increment?metric=impressions', {
  method: 'POST'
})
.then(res => res.json())
.then(data => console.log(data));
```

---

## Response Examples

### Success Response (202 Accepted)
```json
{
  "ok": true,
  "status": "queued"
}
```

**HTTP Headers**:
```
HTTP/1.1 202 Accepted
Content-Type: application/json
Content-Length: 35
```

---

## Error Responses

### Invalid Metric (400 Bad Request)
```bash
curl -X POST "http://localhost:3000/api/v1/posts/123/increment?metric=invalid"
```

**Response**:
```json
{
  "statusCode": 400,
  "message": "Invalid metric: invalid. Must be 'postOpen' or 'impressions'.",
  "error": "Bad Request"
}
```

---

### Invalid Post ID Format (400 Bad Request)
```bash
curl -X POST "http://localhost:3000/api/v1/posts/not-a-number/increment?metric=postOpen"
```

**Response**:
```json
{
  "statusCode": 400,
  "message": "Invalid post ID format",
  "error": "Bad Request"
}
```

---

### Missing Metric Parameter (400 Bad Request)
```bash
curl -X POST "http://localhost:3000/api/v1/posts/123/increment"
```

**Response**:
```json
{
  "statusCode": 400,
  "message": "Invalid metric: undefined. Must be 'postOpen' or 'impressions'.",
  "error": "Bad Request"
}
```

---

### Rate Limit Exceeded (429 Too Many Requests)
```
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1707418860
```

**Response**:
```json
{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests"
}
```

---

## Batch Processing Example

### Process Multiple Metrics
```bash
#!/bin/bash

POST_ID="123456789"

# Increment postOpen 5 times
for i in {1..5}; do
  curl -X POST "http://localhost:3000/api/v1/posts/$POST_ID/increment?metric=postOpen"
  echo "Incremented postOpen ($i/5)"
done

# Increment impressions 10 times
for i in {1..10}; do
  curl -X POST "http://localhost:3000/api/v1/posts/$POST_ID/increment?metric=impressions"
  echo "Incremented impressions ($i/10)"
done
```

---

## Integration Examples

### React Component
```javascript
const incrementPostMetric = async (postId, metric) => {
  try {
    const response = await fetch(
      `/api/v1/posts/${postId}/increment?metric=${metric}`,
      { method: 'POST' }
    );
    
    if (response.ok) {
      console.log('Metric incremented');
    } else {
      console.error('Failed to increment metric');
    }
  } catch (error) {
    console.error('Error:', error);
  }
};

// Usage
incrementPostMetric('123456789', 'postOpen');
```

### Node.js with Axios
```javascript
const axios = require('axios');

const incrementPostMetric = async (postId, metric) => {
  try {
    const response = await axios.post(
      `http://localhost:3000/api/v1/posts/${postId}/increment`,
      {},
      { params: { metric } }
    );
    console.log('Response:', response.data); // { ok: true, status: 'queued' }
  } catch (error) {
    console.error('Error:', error.response.data);
  }
};

incrementPostMetric('123456789', 'postOpen');
```

---

## Database Query Examples

### Check Current Metrics
```sql
SELECT id, postOpen, impressions 
FROM post 
WHERE id = 123456789;
```

**Result**:
```
id         | postOpen | impressions
-----------|----------|------------
123456789  | 42       | 156
```

### Get Posts with High Impressions
```sql
SELECT id, caption, impressions 
FROM post 
WHERE impressions > 1000 
ORDER BY impressions DESC 
LIMIT 10;
```

### Track Metric Trends
```sql
SELECT 
  DATE(dateUpdated) as date,
  COUNT(*) as total_increments,
  SUM(postOpen) as total_opens,
  SUM(impressions) as total_impressions
FROM post
GROUP BY DATE(dateUpdated)
ORDER BY date DESC
LIMIT 30;
```

---

## Performance Considerations

### Response Time
- **Endpoint Response**: < 10ms (202 Accepted)
- **Async Processing**: Background (non-blocking)
- **Database Update**: Happens after response sent

### Throughput
- **Rate Limit**: 1000 requests per 60 seconds
- **Per Client**: Applied per IP address
- **Recommended**: Space requests evenly to stay within limit

### Best Practices
1. **Don't spam**: Respect rate limits
2. **Error handling**: Check for 400/429 responses
3. **Batch operations**: Group metrics updates efficiently
4. **Cache results**: Consider caching if polling frequently
5. **Monitor logs**: Check server logs for errors

---

## Swagger Documentation

Access full API documentation including:
- Request/response schemas
- Parameter descriptions
- Error responses
- Code examples

**URL**: `http://localhost:3000/api-docs`

Find the endpoint under **Posts** section:
```
POST /api/v1/posts/{postId}/increment
```

---

## Troubleshooting

### Issue: 400 Bad Request - Invalid metric
**Solution**: Use only `postOpen` or `impressions` as metric value

### Issue: 400 Bad Request - Invalid post ID format
**Solution**: Ensure postId is a valid number

### Issue: 429 Too Many Requests
**Solution**: Wait 60 seconds before making more requests to the endpoint

### Issue: Endpoint not found (404)
**Solution**: Ensure application is running and using correct version prefix (`/api/v1/`)

### Issue: Async processing seems slow
**Solution**: This is expected behavior - response is sent immediately, processing happens after

---

## Support

For issues or questions:
1. Check error response messages
2. Review Swagger documentation at `/api-docs`
3. Check server logs for detailed error information
4. Verify database connection is working
