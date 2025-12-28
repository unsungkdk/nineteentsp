# Security & Compliance Standards Proposal

## Overview
This document outlines proposed standards for:
1. HTTP Response Codes
2. Audit Logging (Regulatory Compliance)
3. Rate Limiting (DDoS Protection)

---

## 1. HTTP Response Codes Standard

### Current State
- ✅ Custom error classes with status codes exist (`@tsp/common/errors.ts`)
- ✅ Controllers handle errors and return appropriate status codes
- ⚠️ Need to ensure all edge cases are covered

### Proposed Standard

#### Success Responses
- **200 OK**: Successful GET, PUT, PATCH requests
- **201 Created**: Successful POST requests (resource created)
- **202 Accepted**: Async operations accepted (e.g., report generation)
- **204 No Content**: Successful DELETE requests

#### Client Error Responses
- **400 Bad Request**: Invalid request body/parameters, validation errors
- **401 Unauthorized**: Missing/invalid authentication token
- **403 Forbidden**: Valid token but insufficient permissions
- **404 Not Found**: Resource not found
- **409 Conflict**: Resource conflict (e.g., duplicate email)
- **422 Unprocessable Entity**: Valid format but semantic errors
- **429 Too Many Requests**: Rate limit exceeded (see Rate Limiting section)

#### Server Error Responses
- **500 Internal Server Error**: Unexpected server errors
- **502 Bad Gateway**: Upstream service error
- **503 Service Unavailable**: Service temporarily unavailable
- **504 Gateway Timeout**: Upstream service timeout

### Implementation Plan
1. Add missing error classes: `TooManyRequestsError`, `UnprocessableEntityError`
2. Create standardized error response format
3. Add global error handler middleware
4. Document all API endpoints with expected response codes

---

## 2. Audit Logging System (Regulatory Compliance)

### Requirements
- Track all user sessions and activities
- Log IP addresses (via reverse proxy headers)
- Store routing information
- Compliance with SOC 1, SOC 2, PCI DSS
- Immutable audit trail

### Proposed Architecture

#### Database Schema

**Prisma Schema** (Recommended - Managed via Prisma):
```prisma
model AuditLog {
  id                BigInt    @id @default(autoincrement())
  sessionId         String    @map("session_id") @db.VarChar(255)
  userId            Int?      @map("user_id")
  merchantId        String?   @map("merchant_id") @db.VarChar(50)
  email             String?   @db.VarChar(255)
  ipAddress         String    @map("ip_address") @db.VarChar(45)
  userAgent         String?   @map("user_agent") @db.Text
  requestMethod     String    @map("request_method") @db.VarChar(10)
  requestPath       String    @map("request_path") @db.Text
  requestQuery      Json?     @map("request_query")
  requestBody       Json?     @map("request_body")
  responseStatus    Int       @map("response_status")
  responseTimeMs    Int?      @map("response_time_ms")
  routeName         String?   @map("route_name") @db.VarChar(255)
  actionType        String?   @map("action_type") @db.VarChar(50)
  metadata          Json?     @db.JsonB
  createdAt         DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)

  @@index([sessionId], name: "idx_audit_logs_session_id")
  @@index([userId], name: "idx_audit_logs_user_id")
  @@index([merchantId], name: "idx_audit_logs_merchant_id")
  @@index([createdAt], name: "idx_audit_logs_created_at")
  @@index([ipAddress], name: "idx_audit_logs_ip_address")
  @@map("audit_logs")
}
```

**Raw SQL** (Alternative - if not using Prisma):
```sql
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  user_id INTEGER,
  merchant_id VARCHAR(50),
  email VARCHAR(255),
  ip_address VARCHAR(45) NOT NULL,
  user_agent TEXT,
  request_method VARCHAR(10) NOT NULL,
  request_path TEXT NOT NULL,
  request_query JSONB,
  request_body JSONB,
  response_status INTEGER NOT NULL,
  response_time_ms INTEGER,
  route_name VARCHAR(255),
  action_type VARCHAR(50),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_session_id ON audit_logs(session_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_merchant_id ON audit_logs(merchant_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_ip_address ON audit_logs(ip_address);
```

#### IP Address Detection (Reverse Proxy - Nginx)

**Using Nginx as Reverse Proxy**: All requests pass through Nginx, which sets headers.

**Priority order for IP detection:**
```typescript
// Priority order for IP detection:
1. X-Forwarded-For (first IP if multiple) - Set by Nginx/load balancer
2. X-Real-IP - Set by Nginx
3. CF-Connecting-IP (Cloudflare) - If Cloudflare is in front
4. request.ip (direct connection) - Fallback only
```

**Nginx Configuration:**
```nginx
# In Nginx config, ensure these headers are set:
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

#### Implementation Components

**1. Audit Service** (`packages/common/src/audit.ts`)
- **Non-blocking log creation** (async queue)
- Data masking (passwords, tokens, PII)
- Batch insertion for performance
- Real-time alerting helper for suspicious activities

**2. Audit Middleware** (`services/*/src/middleware/audit.middleware.ts`)
- Automatic logging for all requests (**non-blocking**)
- Extract IP from Nginx headers (X-Forwarded-For, X-Real-IP)
- Capture request/response details
- Generate session IDs
- Async queue for log insertion (doesn't block request processing)

**3. Session Tracking**
- Generate unique session ID per request
- Link related requests (e.g., sign-in → verify-otp)
- Track user journey

**4. Real-Time Alerting Helper** (`packages/common/src/audit-alerts.ts`)
- Monitor audit logs for suspicious patterns
- Alert on:
  - Multiple failed login attempts from same IP
  - Unusual request patterns
  - Rate limit violations
  - Suspicious IP addresses
- Configurable alert thresholds
- Integration with notification systems (email, Slack, etc.)

### Data Retention
- **Active logs**: 90 days (hot storage)
- **Archived logs**: 7 years (cold storage, encrypted)
- **Compliance logs**: Immutable, never deleted

### Privacy & Security
- Mask sensitive data (passwords, tokens, PII)
- Encrypt audit logs at rest
- Access control (only authorized personnel)
- Audit log access itself logged

---

## 3. Rate Limiting (DDoS Protection)

### Requirements
- Rate limit all APIs (sign-in, sign-up, etc.)
- Multiple time windows: per second, per minute, per hour, per 24 hours
- Per-user/IP based limiting
- Different limits for different endpoints

### Proposed Architecture

#### Rate Limit Strategy

**Using Redis with sliding window algorithm**

**IMPORTANT**: All rate limits are **PER IP ADDRESS** (not total across all users).

**Standardized Rate Limit Configuration:**
```typescript
// Rate limit configuration per endpoint
// Each limit applies PER IP ADDRESS
// Can be overridden per merchant tier in database
interface RateLimitConfig {
  perSecond: number;   // Requests per second per IP
  perMinute: number;   // Requests per minute per IP
  perHour: number;     // Requests per hour per IP
  perDay: number;      // Requests per 24 hours per IP
}

// Base rate limits per endpoint (per IP)
const baseRateLimits: Record<string, RateLimitConfig> = {
  '/api/auth/signup': {
    perSecond: 2,    // 2 requests per second per IP
    perMinute: 5,    // 5 requests per minute per IP
    perHour: 10,     // 10 requests per hour per IP
    perDay: 20,      // 20 requests per 24 hours per IP
  },
  '/api/auth/signin': {
    perSecond: 3,    // 3 requests per second per IP
    perMinute: 10,   // 10 requests per minute per IP
    perHour: 30,     // 30 requests per hour per IP
    perDay: 100,     // 100 requests per 24 hours per IP
  },
  '/api/auth/send-otp': {
    perSecond: 1,    // 1 request per second per IP
    perMinute: 3,    // 3 requests per minute per IP
    perHour: 10,     // 10 requests per hour per IP
    perDay: 30,      // 30 requests per 24 hours per IP
  },
  '/api/auth/verify-otp': {
    perSecond: 2,    // 2 requests per second per IP
    perMinute: 10,   // 10 requests per minute per IP
    perHour: 50,     // 50 requests per hour per IP
    perDay: 200,     // 200 requests per 24 hours per IP
  },
  // Add more endpoints as needed
};

// Merchant tier multipliers (optional)
// Premium merchants get higher limits
const merchantTierMultipliers = {
  'free': 1.0,      // Base limits
  'basic': 1.5,     // 1.5x base limits
  'premium': 2.0,   // 2x base limits
  'enterprise': 5.0 // 5x base limits
};
```

**Rate Limit Key Strategy:**
- **Per IP**: `rate_limit:{endpoint}:{ip_address}:{window}`
- **Per User** (if authenticated): `rate_limit:{endpoint}:{user_id}:{window}` (optional, stricter)
- **Combined** (recommended): Check both IP and user limits, use the stricter one

#### Implementation Components

**1. Rate Limit Service** (`packages/common/src/rateLimit.ts`)
- Redis-based rate limiting
- Sliding window algorithm
- Multiple time window checks
- Returns remaining requests and reset time

**2. Rate Limit Middleware** (`services/*/src/middleware/rateLimit.middleware.ts`)
- Check all time windows
- Return 429 with proper headers
- Log rate limit violations

**3. Rate Limit Headers**
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 5
X-RateLimit-Reset: 1640995200
X-RateLimit-Reset-After: 60
```

#### Rate Limit Implementation Details

**Key Format:**
```typescript
// Per IP address (primary)
rate_limit:{endpoint}:ip:{ip_address}:{window}

// Per user (optional, for authenticated requests)
rate_limit:{endpoint}:user:{user_id}:{window}

Examples:
- rate_limit:/api/auth/signup:ip:192.168.1.1:second
- rate_limit:/api/auth/signin:ip:192.168.1.1:minute
- rate_limit:/api/auth/signin:user:123:hour (if authenticated)
- rate_limit:/api/auth/send-otp:ip:192.168.1.1:day
```

**Rate Limit Logic:**
1. Extract IP address from request (via Nginx headers)
2. For each time window (second, minute, hour, day):
   - Check IP-based limit
   - If authenticated, also check user-based limit (optional)
   - Use the stricter limit
3. If any window is exceeded, return 429
4. Log rate limit violations to audit log

**Configurable Per Merchant Tier:**
- Store merchant tier in database
- Apply multiplier to base limits
- Can be configured per merchant via admin panel

#### Blocking Strategy
- **Soft limit**: Return 429, allow after reset
- **Hard limit**: Temporary IP block (e.g., 1 hour) after repeated violations
- **Whitelist**: Bypass for trusted IPs/merchants

---

## Implementation Priority

### Phase 1: Response Codes (Week 1)
1. Add missing error classes
2. Standardize error response format
3. Add global error handler
4. Update API documentation

### Phase 2: Rate Limiting (Week 2)
1. Implement rate limit service
2. Create rate limit middleware
3. Configure limits per endpoint
4. Add rate limit headers
5. Test with load testing

### Phase 3: Audit Logging (Week 3-4)
1. Create database schema
2. Implement audit service
3. Create audit middleware
4. Add IP detection logic
5. Implement data masking
6. Set up log archival

---

## Implementation Details & Standards

### Rate Limiting Standards
✅ **All limits are PER IP ADDRESS** (not total)
✅ **Configurable per merchant tier** via database multipliers
✅ **Standardized per endpoint** - no default limits, must be explicitly configured
✅ **Multiple time windows** checked simultaneously (second, minute, hour, day)
✅ **Redis-based** sliding window algorithm for accuracy

### Audit Logging Standards
✅ **Non-blocking** - Uses async queue, doesn't block request processing
✅ **Real-time alerting** - Helper service monitors for suspicious patterns
✅ **Nginx reverse proxy** - IP detection via X-Forwarded-For and X-Real-IP headers
✅ **Batch insertion** - Groups logs for efficient database writes
✅ **Data masking** - Automatically masks passwords, tokens, and PII

### Response Codes Standards
✅ **Standardized error format** across all APIs
✅ **Proper HTTP status codes** for all scenarios
✅ **Consistent error response structure**

## Configuration Requirements

### Rate Limit Configuration
- Each endpoint must have explicit rate limits defined
- No default fallback - missing endpoints will reject requests
- Limits can be overridden per merchant tier
- All limits are per IP address

### Audit Logging Configuration
- All requests logged automatically (non-blocking)
- Request bodies logged for sensitive endpoints only
- PII masking enabled by default
- Real-time alerting thresholds configurable

### Nginx Configuration Required
- Must set `X-Real-IP` and `X-Forwarded-For` headers
- Trust these headers in application code
- Logging of proxy headers for debugging

---

## Recommended Packages

- **Rate Limiting**: `@fastify/rate-limit` or custom Redis-based solution
- **IP Detection**: `@fastify/forwarded` or custom header parsing
- **Audit Logging**: Custom implementation with Prisma/PostgreSQL

---

## Next Steps

1. Review and approve this proposal
2. Clarify questions above
3. Finalize rate limit values
4. Begin Phase 1 implementation

