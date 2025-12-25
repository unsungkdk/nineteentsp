import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  database: {
    url: process.env.DATABASE_URL || '',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  jwt: {
    secret: process.env.JWT_SECRET || '',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  surepass: {
    apiKey: process.env.SUREPASS_API_KEY || '',
    apiUrl: process.env.SUREPASS_API_URL || 'https://api.surepass.io',
  },
  storage: {
    bucket: process.env.STORAGE_BUCKET || 'tsp-kyc-documents',
    region: process.env.STORAGE_REGION || 'ap-south-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
};

