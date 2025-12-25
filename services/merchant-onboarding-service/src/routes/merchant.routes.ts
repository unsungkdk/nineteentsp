import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.middleware';

export async function merchantRoutes(fastify: FastifyInstance) {
  // Example protected route - Get merchant profile
  fastify.get(
    '/api/merchant/profile',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get merchant profile (Protected)',
        tags: ['Merchant'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              merchant: {
                type: 'object',
                properties: {
                  id: { type: 'number' },
                  merchantId: { type: 'string' },
                  email: { type: 'string' },
                  name: { type: 'string' },
                  kycVerified: { type: 'boolean' },
                  isActive: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      // User is attached to request by authenticate middleware
      const merchantId = request.user!.merchantId;

      // Check for new token in response header (sliding session refresh)
      const newToken = reply.getHeader('X-New-Token');
      if (newToken) {
        return reply.status(200).send({
          success: true,
          merchant: {
            merchantId: request.user!.merchantId,
            email: request.user!.email,
            kycVerified: request.user!.kycVerified,
            isActive: request.user!.isActive,
          },
          token: newToken, // Return new token if refreshed
        });
      }

      return reply.status(200).send({
        success: true,
        merchant: {
          merchantId: request.user!.merchantId,
          email: request.user!.email,
          kycVerified: request.user!.kycVerified,
          isActive: request.user!.isActive,
        },
      });
    }
  );
}

