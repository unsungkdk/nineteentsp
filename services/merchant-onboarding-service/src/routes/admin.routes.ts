import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { adminController } from '../controllers/admin.controller';
import { authenticateAdmin } from '../middleware/adminAuth.middleware';
import { logger } from '@tsp/common';

// Validation schemas
const adminSignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const updateMerchantProfileSchema = z.object({
  typeOfEntity: z.string().max(100).optional(),
  pan: z.string().length(10).optional(),
  incorporationDate: z.string().optional(), // ISO date string
  gst: z.string().max(15).optional(),
  businessAddress: z.string().optional(),
  registrationNumber: z.string().max(100).optional(),
  mccCodes: z.any().optional(),
  directorDetails: z.any().optional(),
  shareholdingPatterns: z.any().optional(),
  uboDetails: z.any().optional(),
  accountDetails: z.any().optional(),
  whitelistedIps: z.any().optional(),
  apDetails: z.any().optional(),
  averageTicketSize: z.number().optional(),
  averageVolume: z.number().optional(),
  expectedTurnover: z.number().optional(),
  turnoverDoneTillDate: z.number().optional(),
  numberOfTransactionsDone: z.number().int().optional(),
});

const adminPasswordResetRequestSchema = z.object({
  email: z.string().email(),
});

const adminPasswordResetVerifySchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
  newPassword: z.string().min(8),
});

export async function adminRoutes(fastify: FastifyInstance) {
  // Admin Sign In
  fastify.post(
    '/api/admin/signin',
    {
      schema: {
        description: 'Admin sign in - Returns JWT token on success',
        tags: ['Admin'],
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
          },
        },
        response: {
          200: {
            description: 'Success - Sign in successful',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              token: { type: 'string' },
              admin: {
                type: 'object',
                properties: {
                  id: { type: 'number' },
                  email: { type: 'string' },
                  name: { type: 'string' },
                  role: { type: 'string' },
                  isActive: { type: 'boolean' },
                },
              },
            },
          },
          401: {
            description: 'Unauthorized - Invalid email or password',
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              error: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Invalid email or password' },
                  statusCode: { type: 'number', example: 401 },
                },
              },
            },
          },
          403: {
            description: 'Forbidden - Admin account is disabled',
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              error: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Admin account is disabled. Please contact support.' },
                  statusCode: { type: 'number', example: 403 },
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
      const validated = adminSignInSchema.parse(request.body);
      return adminController.signIn({ ...request, body: validated } as any, reply);
    }
  );

  // Get All Merchants (Protected)
  fastify.get(
    '/api/admin/merchants',
    {
      preHandler: [authenticateAdmin],
      schema: {
        description: 'Get all merchants with pagination and search (Admin only)',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'number', minimum: 1, default: 1 },
            limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
            search: { type: 'string' },
          },
        },
        response: {
          200: {
            description: 'Success - Returns list of merchants',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              merchants: {
                type: 'array',
                items: {
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
                      nineteenMerchantId: { type: 'string' },
                      typeOfEntity: { type: 'string', nullable: true },
                      pan: { type: 'string', nullable: true },
                      incorporationDate: { type: 'string', format: 'date-time', nullable: true },
                      gst: { type: 'string', nullable: true },
                      businessAddress: { type: 'string', nullable: true },
                      registrationNumber: { type: 'string', nullable: true },
                      mccCodes: { type: 'object', nullable: true, additionalProperties: true },
                      directorDetails: { type: 'object', nullable: true, additionalProperties: true },
                      shareholdingPatterns: { type: 'object', nullable: true, additionalProperties: true },
                      uboDetails: { type: 'object', nullable: true, additionalProperties: true },
                      accountDetails: { type: 'object', nullable: true, additionalProperties: true },
                      whitelistedIps: { type: 'object', nullable: true, additionalProperties: true },
                      apDetails: { type: 'object', nullable: true, additionalProperties: true },
                      averageTicketSize: { type: 'number', nullable: true },
                      averageVolume: { type: 'number', nullable: true },
                      expectedTurnover: { type: 'number', nullable: true },
                      turnoverDoneTillDate: { type: 'number', nullable: true },
                      numberOfTransactionsDone: { type: 'number' },
                      createdAt: { type: 'string', format: 'date-time', nullable: true },
                      updatedAt: { type: 'string', format: 'date-time', nullable: true },
                    },
                  },
                  },
                },
              },
              pagination: {
                type: 'object',
                properties: {
                  page: { type: 'number' },
                  limit: { type: 'number' },
                  total: { type: 'number' },
                  totalPages: { type: 'number' },
                },
              },
            },
          },
          401: {
            description: 'Unauthorized - Invalid or missing authentication token',
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
        },
      },
    },
    async (request, reply) => {
      return adminController.getAllMerchants(request, reply);
    }
  );

  // Get Merchant by ID (Query Parameter) - Alternative endpoint
  fastify.get(
    '/api/admin/merchant',
    {
      preHandler: [authenticateAdmin],
      schema: {
        description: 'Get merchant details by merchant ID using query parameter (Admin only)',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          required: ['merchantId'],
          properties: {
            merchantId: { type: 'string', description: 'The 8-digit merchant ID' },
          },
        },
        response: {
          200: {
            description: 'Success - Returns merchant details with full profile',
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
                      typeOfEntity: { type: 'string', nullable: true },
                      pan: { type: 'string', nullable: true },
                      incorporationDate: { type: 'string', format: 'date-time', nullable: true },
                      gst: { type: 'string', nullable: true },
                      businessAddress: { type: 'string', nullable: true },
                      registrationNumber: { type: 'string', nullable: true },
                      mccCodes: { type: 'object', nullable: true, additionalProperties: true },
                      directorDetails: { type: 'object', nullable: true, additionalProperties: true },
                      shareholdingPatterns: { type: 'object', nullable: true, additionalProperties: true },
                      uboDetails: { type: 'object', nullable: true, additionalProperties: true },
                      accountDetails: { type: 'object', nullable: true, additionalProperties: true },
                      whitelistedIps: { type: 'object', nullable: true, additionalProperties: true },
                      apDetails: { type: 'object', nullable: true, additionalProperties: true },
                      averageTicketSize: { type: 'number', nullable: true },
                      averageVolume: { type: 'number', nullable: true },
                      expectedTurnover: { type: 'number', nullable: true },
                      turnoverDoneTillDate: { type: 'number', nullable: true },
                      numberOfTransactionsDone: { type: 'number' },
                      createdAt: { type: 'string', format: 'date-time', nullable: true },
                      updatedAt: { type: 'string', format: 'date-time', nullable: true },
                    },
                  },
                },
              },
            },
          },
          400: {
            description: 'Bad Request - Missing merchantId parameter',
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              error: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'merchantId query parameter is required' },
                  statusCode: { type: 'number', example: 400 },
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
      return adminController.getMerchantByQuery(request, reply);
    }
  );

  // Get Merchant by ID (Path Parameter) - Original endpoint
  fastify.get(
    '/api/admin/merchants/:merchantId',
    {
      preHandler: [authenticateAdmin],
      schema: {
        description: 'Get merchant details by merchant ID using path parameter (Admin only)',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['merchantId'],
          properties: {
            merchantId: { type: 'string' },
          },
        },
        response: {
          200: {
            description: 'Success - Returns merchant details with full profile',
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
                      typeOfEntity: { type: 'string', nullable: true },
                      pan: { type: 'string', nullable: true },
                      incorporationDate: { type: 'string', format: 'date-time', nullable: true },
                      gst: { type: 'string', nullable: true },
                      businessAddress: { type: 'string', nullable: true },
                      registrationNumber: { type: 'string', nullable: true },
                      mccCodes: { type: 'object', nullable: true },
                      directorDetails: { type: 'object', nullable: true },
                      shareholdingPatterns: { type: 'object', nullable: true },
                      uboDetails: { type: 'object', nullable: true },
                      accountDetails: { type: 'object', nullable: true },
                      whitelistedIps: { type: 'object', nullable: true },
                      apDetails: { type: 'object', nullable: true },
                      averageTicketSize: { type: 'number', nullable: true },
                      averageVolume: { type: 'number', nullable: true },
                      expectedTurnover: { type: 'number', nullable: true },
                      turnoverDoneTillDate: { type: 'number', nullable: true },
                      numberOfTransactionsDone: { type: 'number' },
                      createdAt: { type: 'string', format: 'date-time', nullable: true },
                      updatedAt: { type: 'string', format: 'date-time', nullable: true },
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
        },
      },
    },
    async (request, reply) => {
      return adminController.getMerchantById(request as any, reply);
    }
  );

  // Update Merchant Profile (Protected)
  fastify.put(
    '/api/admin/merchants/:merchantId/profile',
    {
      preHandler: [authenticateAdmin],
      preValidation: async (request, reply) => {
        // Log the incoming request body for debugging
        logger.info('[Admin Routes] Update merchant profile request body:', {
          body: request.body,
          params: request.params,
        });
      },
      schema: {
        description: 'Update or create merchant profile (Admin only)',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['merchantId'],
          properties: {
            merchantId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: {
            typeOfEntity: { type: 'string', maxLength: 100 },
            pan: { type: 'string', maxLength: 10 },
            incorporationDate: { type: 'string', format: 'date' },
            gst: { type: 'string', maxLength: 15 },
            businessAddress: { type: 'string' },
            registrationNumber: { type: 'string', maxLength: 100 },
            // Allow object or null for JSON fields - Zod will validate the structure
            // Using array syntax for JSON Schema Draft 7+ compatibility
            mccCodes: { type: ['object', 'null'] },
            directorDetails: { type: ['object', 'null'] },
            shareholdingPatterns: { type: ['object', 'null'] },
            uboDetails: { type: ['object', 'null'] },
            accountDetails: { type: ['object', 'null'] },
            whitelistedIps: { type: ['object', 'null'] },
            apDetails: { type: ['object', 'null'] },
            // Allow number or null - Zod will validate
            averageTicketSize: { type: ['number', 'null'] },
            averageVolume: { type: ['number', 'null'] },
            expectedTurnover: { type: ['number', 'null'] },
            turnoverDoneTillDate: { type: ['number', 'null'] },
            numberOfTransactionsDone: { type: ['number', 'null'] },
          },
        },
        response: {
          200: {
            description: 'Success - Profile updated',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              profile: {
                type: 'object',
                properties: {
                  nineteenMerchantId: { type: 'string' },
                  typeOfEntity: { type: 'string', nullable: true },
                  pan: { type: 'string', nullable: true },
                  incorporationDate: { type: 'string', format: 'date-time', nullable: true },
                  gst: { type: 'string', nullable: true },
                  businessAddress: { type: 'string', nullable: true },
                  registrationNumber: { type: 'string', nullable: true },
                  mccCodes: { type: 'object', nullable: true, additionalProperties: true },
                  directorDetails: { type: 'object', nullable: true, additionalProperties: true },
                  shareholdingPatterns: { type: 'object', nullable: true, additionalProperties: true },
                  uboDetails: { type: 'object', nullable: true, additionalProperties: true },
                  accountDetails: { type: 'object', nullable: true, additionalProperties: true },
                  whitelistedIps: { type: 'object', nullable: true, additionalProperties: true },
                  apDetails: { type: 'object', nullable: true, additionalProperties: true },
                  averageTicketSize: { type: 'number', nullable: true },
                  averageVolume: { type: 'number', nullable: true },
                  expectedTurnover: { type: 'number', nullable: true },
                  turnoverDoneTillDate: { type: 'number', nullable: true },
                  numberOfTransactionsDone: { type: 'number' },
                  createdAt: { type: 'string', format: 'date-time', nullable: true },
                  updatedAt: { type: 'string', format: 'date-time', nullable: true },
                },
              },
            },
          },
          400: {
            description: 'Bad Request - Validation error',
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              error: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  statusCode: { type: 'number', example: 400 },
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
        },
      },
    },
    async (request, reply) => {
      const validated = updateMerchantProfileSchema.parse(request.body);
      return adminController.updateMerchantProfile(
        { ...request, body: validated } as any,
        reply
      );
    }
  );

  // Disable Merchant Account (Protected)
  fastify.post(
    '/api/admin/merchants/:merchantId/disable',
    {
      preHandler: [authenticateAdmin],
      schema: {
        description: 'Disable merchant account (Admin only)',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['merchantId'],
          properties: {
            merchantId: { type: 'string' },
          },
        },
        response: {
          200: {
            description: 'Success - Account disabled',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              merchant: { type: 'object' },
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
        },
      },
    },
    async (request, reply) => {
      return adminController.disableMerchantAccount(request as any, reply);
    }
  );

  // Enable Merchant Account (Protected)
  fastify.post(
    '/api/admin/merchants/:merchantId/enable',
    {
      preHandler: [authenticateAdmin],
      schema: {
        description: 'Enable merchant account (Admin only)',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['merchantId'],
          properties: {
            merchantId: { type: 'string' },
          },
        },
        response: {
          200: {
            description: 'Success - Account enabled',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              merchant: { type: 'object' },
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
        },
      },
    },
    async (request, reply) => {
      return adminController.enableMerchantAccount(request as any, reply);
    }
  );

  // Admin Password Reset - Request OTP
  fastify.post(
    '/api/admin/password-reset/request',
    {
      schema: {
        description: 'Request admin password reset - sends SMS OTP to registered mobile number. Returns success even if email doesn\'t exist (security best practice).',
        tags: ['Admin'],
        body: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email' },
          },
        },
        response: {
          200: {
            description: 'Success - OTP sent (or generic success message if email doesn\'t exist)',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              maskedMobile: { type: 'string' },
              expiresIn: { type: 'number', description: 'OTP expiry time in seconds' },
            },
          },
          400: {
            description: 'Bad Request - Validation error (mobile not registered)',
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              error: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Mobile number not registered. Please contact support to reset your password.' },
                  statusCode: { type: 'number', example: 400 },
                },
              },
            },
          },
          503: {
            description: 'Service Unavailable - SMS service temporarily unavailable',
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              error: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'SMS service temporarily unavailable. Please try again later or contact support.' },
                  statusCode: { type: 'number', example: 503 },
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
      const validated = adminPasswordResetRequestSchema.parse(request.body);
      return adminController.requestPasswordReset({ ...request, body: validated } as any, reply);
    }
  );

  // Admin Password Reset - Verify OTP and Reset Password
  fastify.post(
    '/api/admin/password-reset/verify',
    {
      schema: {
        description: 'Verify admin password reset OTP and set new password',
        tags: ['Admin'],
        body: {
          type: 'object',
          required: ['email', 'otp', 'newPassword'],
          properties: {
            email: { type: 'string', format: 'email' },
            otp: { type: 'string', minLength: 6, maxLength: 6 },
            newPassword: { type: 'string', minLength: 8 },
          },
        },
        response: {
          200: {
            description: 'Success - Password reset successful',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
          400: {
            description: 'Bad Request - Validation error (invalid password format or OTP format)',
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              error: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Password must be at least 8 characters long' },
                  statusCode: { type: 'number', example: 400 },
                },
              },
            },
          },
          401: {
            description: 'Unauthorized - Invalid or expired OTP',
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              error: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Invalid or expired OTP. Please request a new password reset.' },
                  statusCode: { type: 'number', example: 401 },
                },
              },
            },
          },
          404: {
            description: 'Not Found - Admin not found',
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              error: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Admin not found' },
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
      const validated = adminPasswordResetVerifySchema.parse(request.body);
      return adminController.verifyPasswordReset({ ...request, body: validated } as any, reply);
    }
  );

  // Get Audit Logs
  fastify.get(
    '/api/admin/audit-logs',
    {
      preHandler: [authenticateAdmin],
      schema: {
        description: 'Get merchant audit logs with filters (Admin only)',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'number', minimum: 1, description: 'Page number (default: 1)' },
            limit: { type: 'number', minimum: 1, maximum: 100, description: 'Records per page (default: 50, max: 100)' },
            merchantId: { type: 'string', description: 'Filter by merchant ID' },
            userId: { type: 'number', description: 'Filter by user ID' },
            email: { type: 'string', description: 'Filter by email (partial match)' },
            actionType: { type: 'string', description: 'Filter by action type (e.g., signin, signup, verify_otp)' },
            ipAddress: { type: 'string', description: 'Filter by IP address' },
            startDate: { type: 'string', format: 'date-time', description: 'Start date (ISO format)' },
            endDate: { type: 'string', format: 'date-time', description: 'End date (ISO format)' },
            responseStatus: { type: 'number', description: 'Filter by HTTP response status code' },
            sessionId: { type: 'string', description: 'Filter by session ID' },
          },
        },
        response: {
          200: {
            description: 'Success - Returns audit logs with pagination',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              logs: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    sessionId: { type: 'string' },
                    userId: { type: 'number' },
                    merchantId: { type: 'string' },
                    email: { type: 'string' },
                    ipAddress: { type: 'string' },
                    userAgent: { type: 'string' },
                    requestMethod: { type: 'string' },
                    requestPath: { type: 'string' },
                    requestQuery: { type: 'object' },
                    requestBody: { type: 'object' },
                    responseStatus: { type: 'number' },
                    responseTimeMs: { type: 'number' },
                    routeName: { type: 'string' },
                    actionType: { type: 'string' },
                    metadata: { type: 'object' },
                    createdAt: { type: 'string', format: 'date-time' },
                  },
                },
              },
              pagination: {
                type: 'object',
                properties: {
                  page: { type: 'number' },
                  limit: { type: 'number' },
                  total: { type: 'number' },
                  totalPages: { type: 'number' },
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
      return adminController.getAuditLogs(request, reply);
    }
  );

  // Export Audit Logs as .txt file
  fastify.get(
    '/api/admin/audit-logs/export',
    {
      preHandler: [authenticateAdmin],
      schema: {
        description: 'Export merchant audit logs as standardized .txt file (Admin only)',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'number', minimum: 1, maximum: 50000, description: 'Max records to export (default: 10000, max: 50000)' },
            merchantId: { type: 'string', description: 'Filter by merchant ID' },
            userId: { type: 'number', description: 'Filter by user ID' },
            email: { type: 'string', description: 'Filter by email (partial match)' },
            actionType: { type: 'string', description: 'Filter by action type (e.g., signin, signup, verify_otp)' },
            ipAddress: { type: 'string', description: 'Filter by IP address' },
            startDate: { type: 'string', format: 'date-time', description: 'Start date (ISO format)' },
            endDate: { type: 'string', format: 'date-time', description: 'End date (ISO format)' },
            responseStatus: { type: 'number', description: 'Filter by HTTP response status code' },
            sessionId: { type: 'string', description: 'Filter by session ID' },
          },
        },
        response: {
          200: {
            description: 'Success - Returns audit logs as .txt file',
            type: 'string',
            contentMediaType: 'text/plain',
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
      return adminController.exportAuditLogs(request, reply);
    }
  );
}

