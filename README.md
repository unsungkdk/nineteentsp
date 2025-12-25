# TSP NineteenPay Backend

Transaction Service Provider (TSP) backend system for processing payments between merchants, banks, and Payment Aggregators (PAs) in India.

## Architecture

Microservices-based architecture with Node.js + TypeScript and PostgreSQL.

### Services

1. **Merchant Onboarding Service** - KYB/KYC verification, merchant management
2. **Payment Processing Service** - Pay-in/Payout processing, fee calculation
3. **Transaction Monitoring Service** - Real-time monitoring, fraud detection
4. **Settlement & Reporting Service** - Reports, bank reconciliation, fee distribution

## Tech Stack

- **Runtime**: Node.js 20+ (LTS)
- **Language**: TypeScript
- **Framework**: Fastify
- **Database**: PostgreSQL 15+ with TimescaleDB
- **Cache**: Redis 7+
- **ORM**: Prisma
- **Validation**: Zod

## Prerequisites

- Node.js 20+ and npm 10+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (optional, for local development)

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Environment Variables

Copy `.env.example` to `.env` in each service directory and configure:

```bash
# Example for merchant-onboarding-service
cp services/merchant-onboarding-service/.env.example services/merchant-onboarding-service/.env
```

### 3. Setup Database

```bash
# Start PostgreSQL and Redis using Docker Compose
docker-compose up -d postgres redis

# Run migrations
npm run db:migrate
```

### 4. Start Services

```bash
# Start all services in development mode
npm run dev

# Or start individual services
cd services/merchant-onboarding-service && npm run dev
```

## Project Structure

```
tsp_nineteenpay_backend/
├── services/                    # Microservices
│   ├── merchant-onboarding-service/
│   ├── payment-processing-service/
│   ├── transaction-monitoring-service/
│   └── settlement-reporting-service/
├── packages/                    # Shared packages
│   ├── common/                 # Common utilities
│   ├── types/                  # Shared TypeScript types
│   └── database/               # Database client & migrations
├── docker-compose.yml          # Local development setup
├── package.json               # Root package.json (workspaces)
└── README.md
```

## Development

### Running Services

```bash
# All services
npm run dev

# Individual service
cd services/merchant-onboarding-service
npm run dev
```

### Database Migrations

```bash
# Generate migration
npm run db:generate --workspace=services/merchant-onboarding-service

# Run migrations
npm run db:migrate --workspace=services/merchant-onboarding-service
```

### Testing

```bash
# Run all tests
npm run test

# Run tests for specific service
cd services/merchant-onboarding-service && npm test
```

## API Documentation

API documentation is available via Swagger UI:
- Merchant Onboarding: http://localhost:3001/api-docs
- Payment Processing: http://localhost:3002/api-docs
- Transaction Monitoring: http://localhost:3003/api-docs
- Settlement & Reporting: http://localhost:3004/api-docs

## Compliance

This system is designed to be compliant with:
- SOC 1 & SOC 2
- VAPT (Vulnerability Assessment & Penetration Testing)
- PCI DSS

## License

Proprietary - All rights reserved

