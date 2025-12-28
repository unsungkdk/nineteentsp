import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.middleware';
import { merchantService } from '../services/merchant.service';
import { logger, AppError, formatErrorResponse } from '@tsp/common';

export async function merchantRoutes(fastify: FastifyInstance) {
  // Get merchant profile with all fields from merchant_profile table
  fastify.get(
    '/api/merchant/profile',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get merchant profile with all fields from merchant_profile table (Protected)',
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
                  name: { type: 'string' },
                  email: { type: 'string' },
                  mobile: { type: 'string' },
                  nineteenMerchantId: { type: 'string' },
                  kycVerified: { type: 'boolean' },
                  isActive: { type: 'boolean' },
                  isSettlementActive: { type: 'boolean' },
                  is2faActive: { type: 'boolean' },
                  isMobileVerified: { type: 'boolean' },
                  isEmailVerified: { type: 'boolean' },
                  state: { type: 'string' },
                  createdAt: { type: 'string', format: 'date-time' },
                  updatedAt: { type: 'string', format: 'date-time' },
                  profile: {
                    type: 'object',
                    properties: {
                      typeOfEntity: { type: 'string' },
                      pan: { type: 'string' },
                      incorporationDate: { type: 'string', format: 'date' },
                      gst: { type: 'string' },
                      businessAddress: { type: 'string' },
                      registrationNumber: { type: 'string' },
                      mccCodes: { type: 'object' },
                      directorDetails: { type: 'object' },
                      shareholdingPatterns: { type: 'object' },
                      uboDetails: { type: 'object' },
                      accountDetails: { type: 'object' },
                      whitelistedIps: { type: 'object' },
                      apDetails: { type: 'object' },
                      averageTicketSize: { type: 'number' },
                      averageVolume: { type: 'number' },
                      expectedTurnover: { type: 'number' },
                      turnoverDoneTillDate: { type: 'number' },
                      numberOfTransactionsDone: { type: 'number' },
                      createdAt: { type: 'string', format: 'date-time' },
                      updatedAt: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
          },
          401: {
            description: 'Unauthorized',
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              error: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  statusCode: { type: 'number', example: 401 },
                },
              },
            },
          },
          404: {
            description: 'Not Found - Merchant not found',
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              error: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Merchant not found' },
                  statusCode: { type: 'number', example: 404 },
                },
              },
            },
          },
          500: {
            description: 'Internal Server Error',
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              error: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Internal server error' },
                  statusCode: { type: 'number', example: 500 },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        // User is attached to request by authenticate middleware
        const merchantId = request.user!.merchantId;

        const result = await merchantService.getMerchantProfile(merchantId);

        // Check for new token in response header (sliding session refresh)
        const newToken = reply.getHeader('X-New-Token');
        if (newToken) {
          return reply.status(200).send({
            ...result,
            token: newToken, // Return new token if refreshed
          });
        }

        return reply.status(200).send(result);
      } catch (error: any) {
        logger.error('[Merchant Controller] Get profile error:', error);

        if (error instanceof AppError) {
          const errorResponse = formatErrorResponse(error);
          return reply.status(error.statusCode || 500).send(errorResponse);
        }

        return reply.status(500).send({
          success: false,
          error: {
            message: 'Internal server error',
            statusCode: 500,
          },
        });
      }
    }
  );
}

