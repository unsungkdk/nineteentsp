# Postman Collection Import Guide

## Import OpenAPI Spec into Postman

The Merchant Onboarding Service API provides an OpenAPI 3.0 specification that can be imported directly into Postman.

### Method 1: Import from URL (Recommended)

1. **Open Postman**
2. Click **Import** button (top left)
3. Select **Link** tab
4. Enter the OpenAPI spec URL:
   ```
   http://64.227.171.110:3001/api-docs/json
   ```
5. Click **Continue** → **Import**

### Method 2: Import from File

1. **Download the OpenAPI spec:**
   ```bash
   curl http://64.227.171.110:3001/api-docs/json -o openapi.json
   ```

2. **In Postman:**
   - Click **Import** button
   - Select **File** tab
   - Choose the downloaded `openapi.json` file
   - Click **Import**

### Method 3: Import from Swagger UI

1. Visit: **http://64.227.171.110:3001/api-docs**
2. Click the **Download** button (if available)
3. Save as `openapi.json`
4. Import into Postman using Method 2

## Postman Collection Features

After importing, you'll have:

### Auth Endpoints
- `POST /api/auth/signup` - Register new merchant
- `POST /api/auth/signin` - Sign in merchant
- `POST /api/auth/send-otp` - Send OTP
- `POST /api/auth/verify-otp` - Verify OTP

### Protected Endpoints
- `GET /api/merchant/profile` - Get merchant profile (requires Bearer token)

## Setting Up Authentication in Postman

1. **Get a token:**
   - Use `POST /api/auth/signin` or `POST /api/auth/verify-otp`
   - Copy the `token` from the response

2. **Set Bearer Token:**
   - Go to **Collection** → **Authorization**
   - Select **Type: Bearer Token**
   - Paste your token in the **Token** field
   - Or set it per-request in the **Authorization** tab

3. **Use Environment Variables (Recommended):**
   - Create a Postman Environment
   - Add variable: `base_url` = `http://64.227.171.110:3001`
   - Add variable: `token` = (your JWT token)
   - Update collection to use `{{base_url}}` and `{{token}}`

## Testing the APIs

### 1. Sign Up
```json
POST {{base_url}}/api/auth/signup
{
  "name": "Test Merchant",
  "email": "merchant@example.com",
  "mobile": "9876543210",
  "password": "password123",
  "state": "Maharashtra"
}
```

### 2. Sign In
```json
POST {{base_url}}/api/auth/signin
{
  "email": "merchant@example.com",
  "password": "password123"
}
```

### 3. Get Profile (Protected)
```
GET {{base_url}}/api/merchant/profile
Authorization: Bearer {{token}}
```

## API Documentation URLs

### OpenAPI Spec (JSON)
- **Production:** http://64.227.171.110:3001/api-docs/json
- **Local Dev:** http://localhost:3001/api-docs/json

### Swagger UI
- **Production:** http://64.227.171.110:3001/api-docs
- **Local Dev:** http://localhost:3001/api-docs

### ReDoc
- **Production:** http://64.227.171.110:3001/redoc
- **Local Dev:** http://localhost:3001/redoc

## Notes

- Tokens expire in 10 minutes (sliding session)
- Check response headers for `X-New-Token` to get refreshed tokens
- All protected endpoints require `Authorization: Bearer <token>` header

