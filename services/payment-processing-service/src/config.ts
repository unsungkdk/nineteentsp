import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3002', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  database: {
    url: process.env.DATABASE_URL || '',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  fee: {
    payInPercentage: parseFloat(process.env.PAY_IN_FEE_PERCENTAGE || '2.5'),
    payoutPercentage: parseFloat(process.env.PAYOUT_FEE_PERCENTAGE || '1.5'),
  },
  bank: {
    apiUrl: process.env.BANK_API_URL || '',
    apiKey: process.env.BANK_API_KEY || '',
  },
  paymentGateway: {
    apiUrl: process.env.PAYMENT_GATEWAY_API_URL || '',
    apiKey: process.env.PAYMENT_GATEWAY_API_KEY || '',
  },
};

