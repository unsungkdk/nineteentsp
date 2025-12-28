import { createClient, RedisClientType } from 'redis';
import { logger } from './logger';

let redisClient: RedisClientType | null = null;

/**
 * Get Redis URL from environment or config
 */
const getRedisUrl = (): string => {
  // Allow services to pass custom URL or use environment variable
  return process.env.REDIS_URL || 'redis://localhost:6379';
};

/**
 * Get Redis client instance (singleton)
 */
export const getRedisClient = async (customUrl?: string): Promise<RedisClientType> => {
  if (!redisClient) {
    const redisUrl = customUrl || getRedisUrl();
    redisClient = createClient({
      url: redisUrl,
    });

    redisClient.on('error', (err) => {
      logger.error(`[Redis] Redis Client Error: ${err}`);
    });

    redisClient.on('connect', () => {
      logger.info('[Redis] Redis Client Connected');
    });

    redisClient.on('ready', () => {
      logger.info('[Redis] Redis Client Ready');
    });

    redisClient.on('reconnecting', () => {
      logger.info('[Redis] Redis Client Reconnecting');
    });

    await redisClient.connect();
  }

  return redisClient;
};

/**
 * Close Redis connection
 */
export const closeRedisConnection = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('[Redis] Redis Client Disconnected');
  }
};

