#!/bin/bash

# Script to download OpenAPI spec for Postman import

BASE_URL="${1:-http://64.227.171.110:3001}"
OUTPUT_FILE="${2:-openapi.json}"

echo "Downloading OpenAPI spec from $BASE_URL/api-docs/json..."
curl -s "$BASE_URL/api-docs/json" -o "$OUTPUT_FILE"

if [ $? -eq 0 ]; then
    echo "✓ OpenAPI spec saved to $OUTPUT_FILE"
    echo "You can now import this file into Postman:"
    echo "  1. Open Postman"
    echo "  2. Click Import"
    echo "  3. Select File tab"
    echo "  4. Choose $OUTPUT_FILE"
else
    echo "✗ Failed to download OpenAPI spec"
    exit 1
fi

