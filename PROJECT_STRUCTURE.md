# Project Structure

```
tsp_nineteenpay_backend/
├── packages/                              # Shared packages
│   ├── common/                            # Common utilities
│   │   ├── src/
│   │   │   ├── logger.ts                 # Winston logger
│   │   │   ├── errors.ts                 # Custom error classes
│   │   │   ├── validation.ts             # Zod validation schemas
│   │   │   ├── auth.ts                   # JWT authentication
│   │   │   ├── utils.ts                  # Utility functions
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── types/                             # Shared TypeScript types
│       ├── src/
│       │   ├── merchant.ts
│       │   ├── transaction.ts
│       │   ├── payment.ts
│       │   ├── settlement.ts
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── services/                              # Microservices
│   ├── merchant-onboarding-service/       # Port 3001
│   │   ├── src/
│   │   │   ├── index.ts                  # Service entry point
│   │   │   ├── config.ts                 # Configuration
│   │   │   ├── routes/                   # API routes
│   │   │   │   ├── merchant.routes.ts
│   │   │   │   └── kyc.routes.ts
│   │   │   ├── controllers/             # Request handlers
│   │   │   │   ├── merchant.controller.ts
│   │   │   │   └── kyc.controller.ts
│   │   │   ├── services/                 # Business logic
│   │   │   │   ├── merchant.service.ts
│   │   │   │   └── kyc.service.ts
│   │   │   └── middleware/               # Custom middleware
│   │   ├── prisma/
│   │   │   └── schema.prisma             # Database schema
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── .env.example
│   │
│   ├── payment-processing-service/        # Port 3002
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── config.ts
│   │   │   ├── routes/
│   │   │   │   ├── payment.routes.ts
│   │   │   │   └── transaction.routes.ts
│   │   │   ├── controllers/
│   │   │   │   ├── payment.controller.ts
│   │   │   │   └── transaction.controller.ts
│   │   │   ├── services/
│   │   │   │   ├── payment.service.ts
│   │   │   │   └── transaction.service.ts
│   │   │   └── middleware/
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── .env.example
│   │
│   ├── transaction-monitoring-service/     # Port 3003
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── config.ts
│   │   │   ├── routes/
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   └── middleware/
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── .env.example
│   │
│   └── settlement-reporting-service/       # Port 3004
│       ├── src/
│       │   ├── index.ts
│       │   ├── config.ts
│       │   ├── routes/
│       │   ├── controllers/
│       │   ├── services/
│       │   └── middleware/
│       ├── prisma/
│       │   └── schema.prisma
│       ├── package.json
│       ├── tsconfig.json
│       └── .env.example
│
├── docker-compose.yml                     # Local development setup
├── package.json                          # Root package.json (workspaces)
├── README.md
├── ARCHITECTURE_RECOMMENDATIONS.md
└── PROJECT_STRUCTURE.md
```

## Service Ports

- Merchant Onboarding Service: `3001`
- Payment Processing Service: `3002`
- Transaction Monitoring Service: `3003`
- Settlement & Reporting Service: `3004`

## Database Schemas

Each service has its own Prisma schema in `prisma/schema.prisma`:
- Merchant Onboarding: Merchants, KYC Documents, Bank Accounts
- Payment Processing: Transactions
- Transaction Monitoring: Transaction Events, Alerts (TimescaleDB)
- Settlement & Reporting: Settlements

## Getting Started

1. Install dependencies: `npm install`
2. Start PostgreSQL & Redis: `docker-compose up -d`
3. Run migrations: `npm run db:migrate` (in each service)
4. Start services: `npm run dev`

