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
    const ipAddress = extractIpAddress(request.headers);

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
      logger.warn(`[Rate Limit] Rate limit exceeded for ${endpoint} from IP ${ipAddress}. Window: ${result.window}, Limit: ${result.limit}`);

      // Return 429 Too Many Requests
      throw new TooManyRequestsError(
        `Rate limit exceeded. Limit: ${result.limit} requests per ${result.window}. Reset at: ${new Date(result.resetTime * 1000).toISOString()}`
      );
    }

    logger.debug(`[Rate Limit] Allowed request for ${endpoint} from IP ${ipAddress}. Remaining: ${result.remaining}/${result.limit} (${result.window})`);
  } catch (error: any) {
    // If it's already a TooManyRequestsError, rethrow it
    if (error instanceof TooManyRequestsError) {
      throw error;
    }

    // For other errors (e.g., Redis connection issues), log and allow request
    // Don't block requests if rate limiting fails
    logger.error(`[Rate Limit] Error checking rate limit: ${error.message}`);
    // Allow request to proceed if rate limiting check fails
  }
};

