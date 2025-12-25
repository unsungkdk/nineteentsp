import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
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
  openapi: {
    info: {
      title: 'Settlement & Reporting Service API',
      description: 'API for settlement reports and bank reconciliation',
      version: '1.0.0',
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: 'Development server',
      },
    ],
  },
});

app.register(swaggerUi, {
  routePrefix: '/api-docs',
});

// Register your routes here

// Health check
app.get('/health', async () => {
  return { status: 'ok', service: 'settlement-reporting-service' };
});

// Start server
const start = async () => {
  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    logger.info(`Settlement & Reporting Service running on port ${config.port}`);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
};

start();
