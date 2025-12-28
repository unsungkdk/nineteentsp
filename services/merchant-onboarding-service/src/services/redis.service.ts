import { createClient, RedisClientType } from 'redis';
import { config } from '../config';
import { logger } from '@tsp/common';

let redisClient: RedisClientType | null = null;

/**
 * Get Redis client instance (singleton)
 */
export const getRedisClient = async (): Promise<RedisClientType> => {
  if (!redisClient) {
    redisClient = createClient({
      url: config.redis.url,
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

