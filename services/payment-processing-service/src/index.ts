import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from 'fastify-swagger';
import { config } from './config';
import { logger } from '@tsp/common';

const app = Fastify({
  logger: true, // Use Fastify's built-in logger
});

// Register plugins
app.register(cors, {
  origin: true,
});

app.register(swagger, {
  routePrefix: '/api-docs',
  swagger: {
    info: {
      title: 'Payment Processing Service API',
      description: 'API for payment processing (Pay-in/Payout)',
      version: '1.0.0',
    },
    host: `localhost:${config.port}`,
    schemes: ['http', 'https'],
    consumes: ['application/json'],
    produces: ['application/json'],
  },
  exposeRoute: true,
});

// Register your routes here

// Health check
app.get('/health', async () => {
  return { status: 'ok', service: 'payment-processing-service' };
});

// Start server
const start = async () => {
  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    logger.info(`Payment Processing Service running on port ${config.port}`);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
};

start();
