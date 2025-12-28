import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root (two levels up from src/config.ts)
const envPath = path.resolve(__dirname, '../../../.env');
dotenv.config({ path: envPath });

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
    expiresIn: process.env.JWT_EXPIRES_IN || '10m', // 10 minutes for sliding session
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
  brevo: {
    apiKey: process.env.BREVO_KEY || '',
    senderEmail: process.env.BREVO_SENDER_EMAIL || 'noreply@nineteenpay.com',
    senderName: process.env.BREVO_SENDER_NAME || 'NineteenPay',
  },
  sms: {
    apiKey: process.env.SMS_API_KEY || '83374b920b1df7d6678d313532cfc671',
    apiUrl: process.env.SMS_API_URL || 'https://sms.par-ken.com/api/smsapi',
    sender: process.env.SMS_SENDER || 'INTTEE',
    route: process.env.SMS_ROUTE || '1',
    type: process.env.SMS_TYPE || '1',
    templateId: process.env.SMS_TEMPLATE_ID || '1707176674769771409',
  },
};

