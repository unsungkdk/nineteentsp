# Database Setup Scripts

## Security & Compliance Setup

### Quick Start

```bash
# Connect to your database
psql -h <host> -p <port> -U <username> -d <database>

# Run the setup script
\i database/security_setup.sql

# Or from command line:
psql -h <host> -p <port> -U <username> -d <database> -f database/security_setup.sql
```

### What Gets Created

1. **audit_logs** - Regulatory compliance audit trail
2. **rate_limit_config** - Rate limit configuration per endpoint
3. **merchant_tier_config** - Merchant tier multipliers
4. **ip_whitelist** - Trusted IP addresses
5. **ip_blacklist** - Blocked IP addresses
6. **rate_limit_violations** - Rate limit violation tracking
7. **suspicious_activity_log** - Suspicious activity alerts

### Default Configurations

The script automatically inserts:
- Default rate limits for auth endpoints
- Default merchant tiers (free, basic, premium, enterprise)
- All necessary indexes and triggers

### Verification

After running the script, verify tables were created:

```sql
-- List all tables
\dt

-- Check audit_logs table
SELECT COUNT(*) FROM audit_logs;

-- Check rate limit config
SELECT * FROM rate_limit_config;

-- Check merchant tiers
SELECT * FROM merchant_tier_config;
```

