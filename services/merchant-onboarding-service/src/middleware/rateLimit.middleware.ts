import { FastifyRequest, FastifyReply } from 'fastify';
import { 
  checkRateLimit, 
  getRateLimitConfig, 
  RateLimitResult,
  getRedisClient,
  extractIpAddress,
} from '@tsp/common';
import { TooManyRequestsError, logger } from '@tsp/common';
import { config } from '../config';

// Initialize Redis connection on module load (uses service config)
let redisInitialized = false;
const initializeRedis = async () => {
  if (!redisInitialized) {
    try {
      await getRedisClient(config.redis.url);
      redisInitialized = true;
    } catch (error: any) {
      logger.error(`[Rate Limit] Failed to initialize Redis: ${error.message}`);
    }
  }
};

/**
 * Rate limit middleware
 * Checks rate limits per IP address for all endpoints
 * Uses Redis with sliding window algorithm
 */
export const rateLimitMiddleware = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  // Skip rate limiting for health check
  if (request.url === '/health' || request.url.startsWith('/api-docs')) {
    return;
  }

  // Initialize Redis if needed
  await initializeRedis();

  try {
    const endpoint = request.url.split('?')[0]; // Remove query params
    const ipAddress = extractIpAddress(request.headers, request.socket);

    // Skip rate limiting if IP cannot be determined (allow request)
    if (ipAddress === 'unknown') {
      logger.warn(`[Rate Limit] IP address unknown for ${endpoint}, skipping rate limit check`);
      return;
    }

    // Get rate limit configuration for this endpoint
    const config = getRateLimitConfig(endpoint);
    
    if (!config) {
      // No rate limit configured for this endpoint - allow
      logger.debug(`[Rate Limit] No rate limit config for ${endpoint}`);
      return;
    }

    // Check rate limit
    const result: RateLimitResult = await checkRateLimit(endpoint, ipAddress, config);

    // Set rate limit headers
    reply.header('X-RateLimit-Limit', result.limit.toString());
    reply.header('X-RateLimit-Remaining', result.remaining.toString());
    reply.header('X-RateLimit-Reset', result.resetTime.toString());
    reply.header('X-RateLimit-Window', result.window);

    if (!result.allowed) {
      const resetTime = new Date(result.resetTime * 1000);
      const secondsUntilReset = Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000));
      
      logger.warn(`[Rate Limit] Rate limit exceeded for ${endpoint} from IP ${ipAddress}. Window: ${result.window}, Limit: ${result.limit}, Reset in: ${secondsUntilReset}s`);

      // Return 429 Too Many Requests with user-friendly message
      const windowNames: Record<string, string> = {
        second: 'second',
        minute: 'minute',
        hour: 'hour',
        day: 'day',
      };
      const windowName = windowNames[result.window] || result.window;
      
      throw new TooManyRequestsError(
        `Too many requests. You have exceeded the limit of ${result.limit} requests per ${windowName}. Please try again in ${secondsUntilReset} second${secondsUntilReset !== 1 ? 's' : ''}.`
      );
    }

    logger.debug(`[Rate Limit] Allowed request for ${endpoint} from IP ${ipAddress}. Remaining: ${result.remaining}/${result.limit} (${result.window})`);
  } catch (error: any) {
    // If it's already a TooManyRequestsError, rethrow it (don't log as error)
    if (error instanceof TooManyRequestsError) {
      // Log as warning since this is expected behavior, not an error
      logger.warn(`[Rate Limit] ${error.message}`);
      throw error;
    }

    // For other errors (e.g., Redis connection issues), log and allow request
    // Don't block requests if rate limiting fails
    // Extract endpoint and IP from request for error logging
    const endpoint = request.url.split('?')[0];
    const ipAddress = extractIpAddress(request.headers, request.socket);
    
    logger.error(`[Rate Limit] Error checking rate limit: ${error.message}`, {
      error: error.stack,
      endpoint,
      ipAddress,
    });
    // Allow request to proceed if rate limiting check fails
  }
};

