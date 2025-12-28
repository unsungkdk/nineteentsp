# Database Setup Explanation

## Overview

This document explains what tables are created and why. We've simplified to only **essential** tables.

---

## Essential Tables (MUST HAVE)

### 1. `audit_logs` - MANDATORY ✅

**Why**: Required for regulatory compliance (SOC 1, SOC 2, PCI DSS). Legal requirement.

**What it stores**:
- Every API request/response
- User sessions, IP addresses, routing information
- Action types (signin, signup, verify_otp, etc.)
- Response codes and timing

**Usage**:
- Compliance audits
- Security investigations
- User activity tracking
- Suspicious activity detection (via queries)

**Cannot skip**: This is a regulatory requirement.

---

## Optional Tables (Can Skip Initially)

### 2. `rate_limit_config` - OPTIONAL ⚪

**Why**: Allows updating rate limits without code deployment.

**What it stores**:
- Rate limits per endpoint (per_second, per_minute, per_hour, per_day)

**Usage**:
- Admin panel to change limits dynamically
- A/B testing different limits
- Emergency adjustments

**Alternative**: 
- Use config files in code (simpler)
- Requires code deployment to change limits

**Recommendation**: 
- Start with config files
- Add this table later if you need dynamic updates

---

### 3. `ip_whitelist` - OPTIONAL ⚪

**Why**: Allow trusted IPs to bypass rate limits.

**What it stores**:
- IP addresses that should never be rate limited

**Usage**:
- Internal services
- Trusted partners
- Monitoring tools

**Alternative**:
- Hardcode in config file if list is small and static

**Recommendation**:
- Add only if you have trusted IPs that need higher limits

---

### 4. `ip_blacklist` - OPTIONAL ⚪

**Why**: Permanently block known attackers.

**What it stores**:
- Blocked IP addresses
- Can be temporary or permanent

**Usage**:
- Block known attackers
- Emergency IP blocking
- Manual blocking via admin panel

**Alternative**:
- Handle at Nginx/WAF level (often better)
- Use Cloudflare/security service blocking

**Recommendation**:
- Usually better to handle at infrastructure level (Nginx/WAF)
- Add this if you need application-level blocking

---

## Tables We Removed (Not Essential)

### ❌ `merchant_tier_config`
**Why removed**: Can hardcode tier multipliers in application code.
**Alternative**: Simple config object in TypeScript.

### ❌ `rate_limit_violations`
**Why removed**: Can track in `audit_logs` table with `action_type = 'rate_limit_violation'`.
**Alternative**: Query `audit_logs` where `response_status = 429`.

### ❌ `suspicious_activity_log`
**Why removed**: Can derive from `audit_logs` via queries.
**Alternative**: Create views or queries that analyze `audit_logs` for suspicious patterns.

---

## Minimal Setup (Only Essential)

If you want the **absolute minimum**, run only:

```sql
-- Only this table is mandatory
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

-- Essential indexes
CREATE INDEX idx_audit_logs_session_id ON audit_logs(session_id);
CREATE INDEX idx_audit_logs_ip_address ON audit_logs(ip_address);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_ip_created ON audit_logs(ip_address, created_at);
```

Everything else (rate limits, IP lists) can be in application config files.

---

## Recommendation

**Phase 1 (Start with)**:
- ✅ `audit_logs` only (mandatory)

**Phase 2 (Add later if needed)**:
- ⚪ `rate_limit_config` - If you need dynamic rate limit updates
- ⚪ `ip_whitelist` - If you have trusted IPs
- ⚪ `ip_blacklist` - If you prefer app-level blocking (usually WAF is better)

The simplified script includes all 4 tables, but you can comment out the optional ones if you prefer to start minimal.

