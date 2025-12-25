# Authentication Implementation

## Overview

This service implements **sliding session authentication** with JWT tokens:
- **Token Expiry**: 10 minutes
- **Auto-Refresh**: Token automatically refreshes on each API call (if valid)
- **Idle Timeout**: If idle for 10+ minutes, user must re-login
- **No Token Table**: Stateless JWT (no database storage needed)

## Authentication Flow

### 1. Sign Up
```
POST /api/auth/signup
Body: { name, email, mobile, password, state? }
→ Creates merchant with unique nineteen_merchant_id
→ Returns: { success, merchant: { id, merchantId, email, name, kycVerified } }
```

### 2. Sign In
```
POST /api/auth/signin
Body: { email, password }
→ Validates credentials
→ If 2FA enabled → returns { requiresOtp: true }
→ Otherwise → returns { token, merchant }
```

### 3. Send OTP (for 2FA or email verification)
```
POST /api/auth/send-otp
Body: { email, otpType: 'email' | 'mobile' | 'sms' }
→ Generates 6-digit OTP
→ Stores in database (expires in 10 min)
→ Sends via email/SMS (placeholder functions - will integrate APIs later)
→ Returns: { success, message, expiresIn: 600 }
```

### 4. Verify OTP
```
POST /api/auth/verify-otp
Body: { email, otp, otpType }
→ Validates OTP (checks expiry, is_used)
→ Marks OTP as used
→ Returns: { token, merchant }
```

## Protected Routes

### Using Auth Middleware

```typescript
import { authenticate } from '../middleware/auth.middleware';

fastify.get(
  '/api/merchant/profile',
  {
    preHandler: [authenticate], // Protect route
    schema: { /* ... */ }
  },
  async (request, reply) => {
    // Access merchant data from request.user
    const merchantId = request.user!.merchantId;
    const email = request.user!.email;
    // ...
  }
);
```

### Token Refresh (Automatic)

The `authenticate` middleware automatically:
1. Validates the JWT token
2. Checks if token expires in < 2 minutes
3. If yes, generates a new token
4. Sends new token in response header: `X-New-Token`

**Client should:**
- Check for `X-New-Token` header in responses
- Update stored token if present
- Use new token for subsequent requests

## JWT Token Structure

```typescript
{
  userId: string,           // merchants_master.id
  merchantId: string,       // nineteen_merchant_id
  email: string,
  role: 'merchant',
  kycVerified: boolean,
  isActive: boolean,
  iat: number,              // Issued at
  exp: number              // Expires at (10 min from issue)
}
```

## Environment Variables

```bash
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=10m          # 10 minutes
BCRYPT_ROUNDS=12
DATABASE_URL=postgresql://...
```

## Database Schema

### merchants_master
- Stores merchant credentials and profile
- `nineteen_merchant_id`: Unique identifier for merchant
- `is_active`: Account status
- `kyc_verified`: KYC verification status
- `is_2fa_active`: 2FA enabled flag

### merchant_otps
- Stores OTPs for verification
- Expires in 10 minutes
- Marked as `is_used` after verification
- Supports: email, mobile, sms

## Placeholder Functions (To Be Implemented)

### SMS OTP Delivery
```typescript
// services/auth.service.ts
const sendOtpSms = async (mobile: string, otp: string): Promise<void> => {
  // TODO: Integrate with SMS API when provided
};
```

### Email OTP Delivery (Brevo)
```typescript
// services/auth.service.ts
const sendOtpEmail = async (email: string, otp: string): Promise<void> => {
  // TODO: Integrate with Brevo API when provided
};
```

## API Endpoints

### Public Endpoints
- `POST /api/auth/signup` - Register new merchant
- `POST /api/auth/signin` - Sign in merchant
- `POST /api/auth/send-otp` - Send OTP
- `POST /api/auth/verify-otp` - Verify OTP

### Protected Endpoints
- `GET /api/merchant/profile` - Get merchant profile (example)

## Next Steps

1. **Run Prisma Migration**:
   ```bash
   cd services/merchant-onboarding-service
   npm run db:generate
   npm run db:migrate
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Integrate OTP APIs**:
   - Replace `sendOtpSms()` with actual SMS API
   - Replace `sendOtpEmail()` with Brevo API

4. **Test Endpoints**:
   - Use Swagger UI at `/api-docs`
   - Test signup → signin → protected route flow

## Security Notes

- ✅ Passwords hashed with bcrypt (12 rounds)
- ✅ JWT tokens expire in 10 minutes
- ✅ OTPs expire in 10 minutes
- ✅ Sliding session (auto-refresh on activity)
- ✅ Account status checked on each request
- ⚠️ OTP APIs need to be integrated (currently placeholders)
- ⚠️ Rate limiting not yet implemented (add later)

