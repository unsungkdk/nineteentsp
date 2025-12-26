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
      title: 'Merchant Onboarding Service API',
      description: 'API for merchant onboarding and KYC verification',
      version: '1.0.0',
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: 'Development server',
      },
      {
        url: 'http://64.227.171.110:3001',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
});

app.register(swaggerUi, {
  routePrefix: '/api-docs',
});

// Redoc documentation
app.get('/redoc', async (request, reply) => {
  const redocHtml = `
<!DOCTYPE html>
<html>
  <head>
    <title>Merchant Onboarding Service API - ReDoc</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
    <style>
      body {
        margin: 0;
        padding: 0;
      }
    </style>
  </head>
  <body>
    <redoc spec-url="/api-docs/json"></redoc>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
  </body>
</html>
  `;
  reply.type('text/html').send(redocHtml);
});

// Register routes
import { authRoutes } from './routes/auth.routes';
import { merchantRoutes } from './routes/merchant.routes';
app.register(authRoutes);
app.register(merchantRoutes);

// Health check
app.get('/health', async () => {
  return { status: 'ok', service: 'merchant-onboarding-service' };
});

// Start server
const start = async () => {
  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    logger.info(`Merchant Onboarding Service running on port ${config.port}`);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
};

start();
