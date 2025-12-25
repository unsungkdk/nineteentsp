# External Database Setup Guide

## Using External PostgreSQL (DigitalOcean Managed Database)

### 1. Get Connection String from DigitalOcean

After creating a managed PostgreSQL database on DigitalOcean, you'll get a connection string like:

```
postgresql://username:password@host:port/database?sslmode=require
```

### 2. Update Environment Variables

In each service's `.env` file, update the `DATABASE_URL`:

```bash
# services/merchant-onboarding-service/.env
DATABASE_URL=postgresql://username:password@host:port/database?sslmode=require&schema=merchant_onboarding

# services/payment-processing-service/.env
DATABASE_URL=postgresql://username:password@host:port/database?sslmode=require&schema=payment_processing

# services/transaction-monitoring-service/.env
DATABASE_URL=postgresql://username:password@host:port/database?sslmode=require&schema=transaction_monitoring

# services/settlement-reporting-service/.env
DATABASE_URL=postgresql://username:password@host:port/database?sslmode=require&schema=settlement_reporting
```

**Note:** 
- Add `?sslmode=require` for secure connection
- Use different schemas for each service (optional but recommended)
- Or use separate databases for each service

### 3. No Special Configuration Needed

Prisma works with external databases out of the box. Just:
1. Update `DATABASE_URL` in `.env`
2. Run `npm run db:generate` to generate Prisma client
3. Run `npm run db:migrate` to run migrations

---

## Using External Redis (DigitalOcean Managed Redis)

### Option 1: DigitalOcean Managed Redis (Recommended)

1. Create a Managed Redis database on DigitalOcean
2. Get the connection URL (usually includes password)
3. Update `REDIS_URL` in each service's `.env`:

```bash
REDIS_URL=rediss://username:password@host:port
```

**Note:** `rediss://` (with double 's') is for SSL/TLS connection

### Option 2: Self-Hosted Redis on DigitalOcean Droplet

1. Create a Droplet and install Redis
2. Configure Redis with password authentication
3. Update firewall rules to allow connections
4. Use connection string:

```bash
REDIS_URL=redis://password@host:port
```

---

## Connection Pooling (Recommended for Production)

For high TPS (100-500), consider using PgBouncer for connection pooling:

1. Install PgBouncer on a separate droplet
2. Configure it to connect to your managed PostgreSQL
3. Update `DATABASE_URL` to point to PgBouncer:

```bash
DATABASE_URL=postgresql://username:password@pgbouncer-host:6432/database?sslmode=require
```

---

## Security Best Practices

1. **Use SSL/TLS**: Always use `sslmode=require` for PostgreSQL
2. **Use Redis with TLS**: Use `rediss://` protocol for Redis
3. **IP Whitelisting**: Whitelist your application server IPs in DigitalOcean
4. **Strong Passwords**: Use strong, unique passwords
5. **Separate Credentials**: Use different credentials for each service (if using separate databases)

---

## Testing Connection

Test your database connection:

```bash
# Test PostgreSQL
psql "postgresql://username:password@host:port/database?sslmode=require"

# Test Redis
redis-cli -h host -p port -a password ping
```

---

## Troubleshooting

### Connection Timeout
- Check firewall rules in DigitalOcean
- Verify IP whitelisting
- Check if database is in same region as your app

### SSL/TLS Errors
- Ensure `sslmode=require` is in connection string
- Check if database supports SSL (most managed databases do)

### Authentication Failed
- Verify username and password
- Check if database user has proper permissions
- Ensure database exists

