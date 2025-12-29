import { getRedisClient } from './redis';
import { logger } from './logger';
import { extractIpAddress } from './audit';

export interface RateLimitConfig {
  perSecond: number;
  perMinute: number;
  perHour: number;
  perDay: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number; // Unix timestamp in seconds
  limit: number;
  window: string;
}

// Base rate limits per endpoint (per IP)
// These can be overridden by database config if needed
export const baseRateLimits: Record<string, RateLimitConfig> = {
  '/api/auth/signup': {
    perSecond: 2,
    perMinute: 5,
    perHour: 10,
    perDay: 20,
  },
  '/api/auth/signin': {
    perSecond: 3,
    perMinute: 10,
    perHour: 30,
    perDay: 100,
  },
  '/api/auth/send-otp': {
    perSecond: 3,      // Allow 3 requests per second (user might retry if OTP not received)
    perMinute: 10,     // Allow 10 requests per minute (reasonable retry limit)
    perHour: 20,       // Allow 20 requests per hour (prevents abuse while allowing legitimate retries)
    perDay: 50,        // Allow 50 requests per day (prevents abuse)
  },
  '/api/auth/verify-otp': {
    perSecond: 2,
    perMinute: 10,
    perHour: 50,
    perDay: 200,
  },
  '/api/auth/password-reset/request': {
    perSecond: 3,      // Allow 3 requests per second (user might retry if OTP not received)
    perMinute: 10,     // Allow 10 requests per minute (reasonable retry limit)
    perHour: 20,       // Allow 20 requests per hour (prevents abuse while allowing legitimate retries)
    perDay: 50,        // Allow 50 requests per day (prevents abuse)
  },
  '/api/auth/password-reset/verify': {
    perSecond: 5,      // Allow multiple verification attempts
    perMinute: 20,     // Allow 20 attempts per minute (user might enter wrong OTP)
    perHour: 100,      // Allow 100 attempts per hour
    perDay: 500,       // Allow 500 attempts per day
  },
  '/api/admin/signin': {
    perSecond: 2,
    perMinute: 5,
    perHour: 20,
    perDay: 50,
  },
  '/api/admin/merchants': {
    perSecond: 5,
    perMinute: 30,
    perHour: 200,
    perDay: 1000,
  },
  '/api/admin/password-reset/request': {
    perSecond: 3,      // Allow 3 requests per second (user might retry if OTP not received)
    perMinute: 10,     // Allow 10 requests per minute (reasonable retry limit)
    perHour: 20,       // Allow 20 requests per hour (prevents abuse while allowing legitimate retries)
    perDay: 50,        // Allow 50 requests per day (prevents abuse)
  },
  '/api/admin/password-reset/verify': {
    perSecond: 2,
    perMinute: 10,
    perHour: 50,
    perDay: 200,
  },
};

/**
 * Get rate limit configuration for an endpoint
 */
export const getRateLimitConfig = (endpoint: string): RateLimitConfig | null => {
  // Try exact match first
  if (baseRateLimits[endpoint]) {
    return baseRateLimits[endpoint];
  }

  // Try prefix match (for dynamic routes)
  for (const [key, config] of Object.entries(baseRateLimits)) {
    if (endpoint.startsWith(key)) {
      return config;
    }
  }

  return null;
};

/**
 * Generate Redis key for rate limit
 */
const getRateLimitKey = (endpoint: string, ipAddress: string, window: string): string => {
  return `rate_limit:${endpoint}:ip:${ipAddress}:${window}`;
};

/**
 * Check rate limit for a single time window
 */
const checkWindowLimit = async (
  endpoint: string,
  ipAddress: string,
  window: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> => {
  const redisClient = await getRedisClient();
  const key = getRateLimitKey(endpoint, ipAddress, window);

  // Get current count
  const current = await redisClient.get(key);
  const count = current ? parseInt(current, 10) : 0;

  // Check if limit exceeded
  if (count >= limit) {
    const ttl = await redisClient.ttl(key);
    return {
      allowed: false,
      remaining: 0,
      resetTime: Math.floor(Date.now() / 1000) + (ttl > 0 ? ttl : windowSeconds),
      limit,
      window,
    };
  }

  // Increment counter
  if (count === 0) {
    // First request in this window, set with TTL
    await redisClient.setEx(key, windowSeconds, '1');
  } else {
    // Increment existing counter
    await redisClient.incr(key);
  }

  const remaining = limit - count - 1;
  const ttl = await redisClient.ttl(key);
  const resetTime = Math.floor(Date.now() / 1000) + (ttl > 0 ? ttl : windowSeconds);

  return {
    allowed: true,
    remaining,
    resetTime,
    limit,
    window,
  };
};

/**
 * Check rate limit across all time windows (second, minute, hour, day)
 * Returns the first limit that is exceeded
 */
export const checkRateLimit = async (
  endpoint: string,
  ipAddress: string,
  config: RateLimitConfig
): Promise<RateLimitResult> => {
  // Check all windows in parallel
  const windows = [
    { name: 'second', limit: config.perSecond, seconds: 1 },
    { name: 'minute', limit: config.perMinute, seconds: 60 },
    { name: 'hour', limit: config.perHour, seconds: 3600 },
    { name: 'day', limit: config.perDay, seconds: 86400 },
  ];

  const results = await Promise.all(
    windows.map((w) => checkWindowLimit(endpoint, ipAddress, w.name, w.limit, w.seconds))
  );

  // Find first limit that was exceeded
  const exceeded = results.find((r) => !r.allowed);
  if (exceeded) {
    return exceeded;
  }

  // All windows passed, return the most restrictive remaining count
  const mostRestrictive = results.reduce((prev, curr) =>
    curr.remaining < prev.remaining ? curr : prev
  );

  return mostRestrictive;
};

// Re-export extractIpAddress from audit module (shared utility)
export { extractIpAddress } from './audit';

