# Using Bulk Import with AI - Example Workflow

## Overview
This guide shows how to use the bulk import feature together with AI (like ChatGPT or Claude) to automatically extract car details from captions.

## Step-by-Step Process

### 1. Export Posts
```bash
curl "http://localhost:3000/bulk-import/export?limit=20&code=YOUR_ADMIN_CODE" \
  -o posts-to-process.csv
```

### 2. Prepare AI Prompt

Create a prompt for your AI assistant:

```
I have a CSV file with Instagram posts about cars. I need you to extract car details from the captions and fill in the empty columns.

For each row, analyze the post_caption and post_cleanedCaption columns and fill in:
- cd_make: Car manufacturer (e.g., Toyota, BMW, Mercedes)
- cd_model: Car model name (e.g., Camry, X5, E-Class)
- cd_variant: Specific variant if mentioned
- cd_registration: Year of registration (YYYY format)
- cd_mileage: Mileage in kilometers (number only)
- cd_transmission: "Automatic" or "Manual"
- cd_fuelType: "Petrol", "Diesel", "Hybrid", "Electric", or "Other"
- cd_engineSize: Engine size (e.g., "2.0L", "3.5L")
- cd_drivetrain: "FWD", "RWD", "AWD", or "4WD"
- cd_seats: Number of seats (usually 2, 4, 5, 7, or 8)
- cd_numberOfDoors: Number of doors (usually 2, 3, 4, or 5)
- cd_bodyType: "Sedan", "SUV", "Hatchback", "Coupe", "Wagon", etc.
- cd_price: Price if mentioned (number only)
- cd_customsPaid: true if customs are paid, false otherwise
- cd_country: Country (e.g., "Georgia")
- cd_city: City (e.g., "Tbilisi")

Rules:
1. Only fill in fields if you're confident about the information
2. Leave fields empty if information is not in the caption
3. Use consistent formats (e.g., "Automatic" not "Auto")
4. For boolean fields, use: true or false
5. For numbers, use digits only (no commas or units)

Here's the CSV:
[paste CSV content here]

Please return the completed CSV with all extracted information filled in.
```

### 3. Process with AI

Option A: **ChatGPT/Claude Web Interface**
1. Copy the CSV content
2. Paste the prompt above
3. Paste the CSV content
4. Copy the returned CSV
5. Save to a file

Option B: **API Integration** (Python example)
```python
import openai
import csv

# Read the CSV
with open('posts-to-process.csv', 'r') as f:
    csv_content = f.read()

# Prepare the prompt
prompt = f"""
Extract car details from captions in this CSV and fill empty columns.
[include your prompt here]

CSV:
{csv_content}
"""

# Call OpenAI API
response = openai.ChatCompletion.create(
    model="gpt-4",
    messages=[
        {"role": "system", "content": "You are a helpful assistant that extracts structured data from text."},
        {"role": "user", "content": prompt}
    ],
    temperature=0.3
)

# Save the result
with open('posts-processed.csv', 'w') as f:
    f.write(response.choices[0].message.content)
```

### 4. Review the Results

Before importing, manually check a few rows to ensure quality:
- Open in Excel/Google Sheets
- Spot-check accuracy
- Verify consistent formatting
- Check for missing critical fields

### 5. Import Back to System

```bash
curl -X POST "http://localhost:3000/bulk-import/import?code=YOUR_ADMIN_CODE" \
  -F "file=@posts-processed.csv"
```

### 6. Handle Errors

If there are errors in the response:
```json
{
  "success": true,
  "summary": {
    "created": 15,
    "updated": 3,
    "errors": [
      {
        "row": 7,
        "error": "Invalid mileage value"
      }
    ]
  }
}
```

Fix the errors:
1. Open the CSV
2. Go to row 7
3. Correct the issue
4. Re-import just those rows

## Tips for Better AI Results

### 1. Process in Batches
- Start with 10-20 rows to test
- Gradually increase batch size
- Monitor accuracy

### 2. Improve Prompts
Add examples to your prompt:
```
Example:
Caption: "2020 Toyota Camry, 50000km, automatic, petrol, 2.5L, ₾25000"
Result:
- cd_make: Toyota
- cd_model: Camry
- cd_registration: 2020
- cd_mileage: 50000
- cd_transmission: Automatic
- cd_fuelType: Petrol
- cd_engineSize: 2.5L
- cd_price: 25000
```

### 3. Use Temperature Control
- Lower temperature (0.1-0.3) for more consistent extraction
- Higher temperature (0.7-0.9) for more creative interpretation

### 4. Validate Critical Fields
Add validation instructions:
```
Critical validations:
- cd_registration must be a 4-digit year (1900-2026)
- cd_mileage must be a positive number
- cd_price must be a positive number
- cd_transmission must be exactly "Automatic" or "Manual"
```

### 5. Handle Ambiguity
Instruct the AI on how to handle unclear cases:
```
If information is ambiguous or unclear:
- Leave the field empty rather than guessing
- Add a note in cd_options field if needed
```

## Advanced: Automated Pipeline

Create a script to automate the entire process:

```bash
#!/bin/bash

# 1. Export
echo "Exporting posts..."
curl -s "http://localhost:3000/bulk-import/export?limit=50&code=$ADMIN_CODE" \
  -o posts-to-process.csv

# 2. Process with AI
echo "Processing with AI..."
python process_with_ai.py posts-to-process.csv posts-processed.csv

# 3. Import
echo "Importing results..."
curl -X POST "http://localhost:3000/bulk-import/import?code=$ADMIN_CODE" \
  -F "file=@posts-processed.csv" \
  -o import-result.json

# 4. Check results
echo "Import summary:"
cat import-result.json | jq '.summary'

# 5. Handle errors if any
errors=$(cat import-result.json | jq '.summary.errors | length')
if [ $errors -gt 0 ]; then
  echo "⚠️  $errors errors occurred. Check import-result.json for details."
else
  echo "✅ Import completed successfully!"
fi
```

## Quality Control Checklist

Before final import, verify:
- [ ] All makes are properly capitalized (Toyota, not toyota)
- [ ] Models are correct (Camry, not Camary)
- [ ] Years are in correct format (2020, not '20)
- [ ] Mileage values are reasonable (50000, not 5000000)
- [ ] Prices are in correct currency
- [ ] Transmission values are standardized
- [ ] Boolean fields use true/false (not yes/no)
- [ ] No obvious typos or mistakes

## Example: Before and After

### Before (Raw Caption)
```
"🚗 2020 ტოიოტა კამრი 2.5 ავტომატი ბენზინი 
50000კმ კარგ მდგომარეობაში ₾25000 📞599123456"
```

### After (Extracted Data)
```
cd_make: Toyota
cd_model: Camry
cd_variant: 
cd_registration: 2020
cd_mileage: 50000
cd_transmission: Automatic
cd_fuelType: Petrol
cd_engineSize: 2.5L
cd_drivetrain: 
cd_seats: 5
cd_numberOfDoors: 4
cd_bodyType: Sedan
cd_price: 25000
cd_customsPaid: 
cd_country: Georgia
cd_city: 
cd_phoneNumber: 599123456
```

## Troubleshooting

### Issue: AI hallucinating details
**Solution**: Add explicit instruction to only use information present in the caption

### Issue: Inconsistent formatting
**Solution**: Provide specific format examples in the prompt

### Issue: Missing critical fields
**Solution**: Mark required fields in the prompt and validate before import

### Issue: Language barriers (Georgian text)
**Solution**: Use AI models that support multiple languages (GPT-4, Claude)

## Cost Estimation

For OpenAI GPT-4 (approximate):
- Processing 100 rows: ~$0.10-0.20
- Processing 1000 rows: ~$1-2
- Monthly processing (5000 rows): ~$5-10

The cost is minimal compared to manual data entry time!

## Conclusion

Using bulk import with AI can save hours of manual work. Start with small batches, refine your prompts, and gradually scale up for best results.

