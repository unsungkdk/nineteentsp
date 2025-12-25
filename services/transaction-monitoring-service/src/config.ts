import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3003', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  database: {
    url: process.env.DATABASE_URL || '',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  aml: {
    apiUrl: process.env.AML_SERVICE_API_URL || '',
    apiKey: process.env.AML_SERVICE_API_KEY || '',
  },
  fraudDetection: {
    apiUrl: process.env.FRAUD_DETECTION_API_URL || '',
    apiKey: process.env.FRAUD_DETECTION_API_KEY || '',
  },
};

