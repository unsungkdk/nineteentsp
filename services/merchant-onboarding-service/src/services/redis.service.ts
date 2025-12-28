// Redis client is now in @tsp/common package
// Re-export with service-specific config
import { getRedisClient as getCommonRedisClient } from '@tsp/common';
import type { RedisClientType } from 'redis';
import { config } from '../config';
import { v4 as uuidv4 } from 'uuid';

export interface MfaSession {
  merchantId: number;
  email: string;
  mobile: string;
  emailOtpVerified: boolean;
  smsOtpVerified: boolean;
  isMfaOnly: boolean; // True for subsequent logins (SMS only), false for first-time activation (email + SMS)
  expiresAt: number; // Unix timestamp
  attempts: number;
}

/**
 * Get Redis client instance with service-specific config
 */
export const getRedisClient = async (): Promise<RedisClientType> => {
  return getCommonRedisClient(config.redis.url);
};

/**
 * Close Redis connection (re-export from common)
 */
export { closeRedisConnection } from '@tsp/common';

/**
 * Generate MFA session token
 */
export const generateMfaSessionToken = (): string => {
  return uuidv4();
};

/**
 * Mask mobile number for display
 */
export const maskMobile = (mobile: string): string => {
  if (mobile.length < 7) return mobile; // Not enough digits to mask meaningfully
  return mobile.substring(0, 4) + '****' + mobile.substring(mobile.length - 3);
};
