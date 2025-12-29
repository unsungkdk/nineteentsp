import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

// Validation schemas
const signUpSchema = z.object({
  name: z.string().min(1).max(2048),
  email: z.string().email(),
  mobile: z.string().min(10).max(20),
  password: z.string().min(8),
  state: z.string().max(100).optional(),
});

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
  location: z.string().min(1),
});

const sendOtpSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please provide a valid email address'),
  otpType: z.enum(['email', 'mobile', 'sms']),
});

const verifyOtpSchema = z.object({
  email: z.string().email().optional(),
  mfaSessionToken: z.string().optional(),
  otp: z.string().length(6),
  otpType: z.enum(['email', 'mobile', 'sms']),
}).refine((data) => data.email || data.mfaSessionToken, {
  message: 'Either email or mfaSessionToken is required',
});

const passwordResetRequestSchema = z.object({
  email: z.string().email(),
});

const passwordResetVerifySchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
  newPassword: z.string().min(8),
});

// No schema needed for logout - no body required

export async function authRoutes(fastify: FastifyInstance) {
  // Sign Up
  fastify.post(
    '/api/auth/signup',
    {
      schema: {
        description: 'Register a new merchant',
        tags: ['Auth'],
        body: {
          type: 'object',
          required: ['name', 'email', 'mobile', 'password'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 2048 },
            email: { type: 'string', format: 'email' },
            mobile: { type: 'string', minLength: 10, maxLength: 20 },
            password: { type: 'string', minLength: 8 },
            state: { type: 'string', maxLength: 100 },
          },
        },
        response: {
          201: {
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
                  isMobileVerified: { type: 'boolean' },
                  isEmailVerified: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      // Validate request body
      const validated = signUpSchema.parse(request.body);
      return authController.signUp({ ...request, body: validated } as any, reply);
    }
  );

  // Sign In
  fastify.post(
    '/api/auth/signin',
    {
      schema: {
        description: 'Sign in merchant - MFA always required. Returns 200 OK with requiresOtp flag if OTP verification is needed.',
        tags: ['Auth'],
        body: {
          type: 'object',
          required: ['email', 'password', 'latitude', 'longitude', 'location'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
            latitude: { type: 'number', description: 'Required: Browser geolocation latitude' },
            longitude: { type: 'number', description: 'Required: Browser geolocation longitude' },
            location: { type: 'string', description: 'Required: Location name/city/state' },
          },
        },
        response: {
          200: {
            description: 'Success - Password valid. OTP verification required or token returned if already authenticated.',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              requiresOtp: { type: 'boolean' },
              message: { type: 'string' },
              mfaSessionToken: { type: 'string' },
              maskedMobile: { type: 'string' },
              needsEmailVerification: { type: 'boolean' },
              needsMobileVerification: { type: 'boolean' },
              isMobileVerified: { type: 'boolean' },
              isEmailVerified: { type: 'boolean' },
              token: { type: 'string' },
              merchant: {
                type: 'object',
                properties: {
                  id: { type: 'number' },
                  merchantId: { type: 'string' },
                  email: { type: 'string' },
                  mobile: { type: 'string' },
                  name: { type: 'string' },
                  kycVerified: { type: 'boolean' },
                  isActive: { type: 'boolean' },
                  isMobileVerified: { type: 'boolean' },
                  isEmailVerified: { type: 'boolean' },
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
            description: 'Forbidden - Account verification required. Different messages for: both unverified, only email unverified, only mobile unverified',
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              requiresOtp: { type: 'boolean', example: true },
              message: { 
                type: 'string', 
                description: 'Message indicating what verification is needed',
                examples: [
                  'Please verify both your email and mobile number to activate your account.',
                  'Please verify your email to activate your account.',
                  'Please verify your mobile number to activate your account.'
                ]
              },
              mfaSessionToken: { type: 'string' },
              maskedMobile: { type: 'string' },
              needsEmailVerification: { type: 'boolean' },
              needsMobileVerification: { type: 'boolean' },
              isMobileVerified: { type: 'boolean' },
              isEmailVerified: { type: 'boolean' },
            },
          },
          422: {
            description: 'Unprocessable Entity - Account in invalid state',
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              error: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Account is in an invalid state. Please contact support for assistance.' },
                  statusCode: { type: 'number', example: 422 },
                },
              },
            },
          },
          503: {
            description: 'Service Unavailable - SMS/Email service temporarily unavailable',
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
      const validated = signInSchema.parse(request.body);
      return authController.signIn({ ...request, body: validated } as any, reply);
    }
  );

  // Send OTP
  fastify.post(
    '/api/auth/send-otp',
    {
      schema: {
        description: 'Send OTP to email or mobile',
        tags: ['Auth'],
        body: {
          type: 'object',
          required: ['email', 'otpType'],
          properties: {
            email: { 
              type: 'string', 
              format: 'email',
              minLength: 1,
              pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$'
            },
            otpType: { type: 'string', enum: ['email', 'mobile', 'sms'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              expiresIn: { type: 'number' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const validated = sendOtpSchema.parse(request.body);
      return authController.sendOtp({ ...request, body: validated } as any, reply);
    }
  );

  // Verify OTP
  fastify.post(
    '/api/auth/verify-otp',
    {
      schema: {
        description: 'Verify OTP and get token - MFA sessions only accept SMS OTP (not email). Supports MFA session token or email (legacy).',
        tags: ['Auth'],
        body: {
          type: 'object',
          required: ['otp', 'otpType'],
          properties: {
            email: { type: 'string', format: 'email' },
            mfaSessionToken: { type: 'string' },
            otp: { type: 'string', minLength: 6, maxLength: 6 },
            otpType: { type: 'string', enum: ['email', 'mobile', 'sms'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              requiresOtp: { type: 'boolean' },
              mfaSessionToken: { type: 'string' },
              emailOtpVerified: { type: 'boolean' },
              smsOtpVerified: { type: 'boolean' },
              needsEmailVerification: { type: 'boolean' },
              needsMobileVerification: { type: 'boolean' },
              token: { type: 'string' },
              merchant: {
                type: 'object',
                properties: {
                  id: { type: 'number' },
                  merchantId: { type: 'string' },
                  email: { type: 'string' },
                  mobile: { type: 'string' },
                  name: { type: 'string' },
                  kycVerified: { type: 'boolean' },
                  isActive: { type: 'boolean' },
                  isMobileVerified: { type: 'boolean' },
                  isEmailVerified: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const validated = verifyOtpSchema.parse(request.body);
      return authController.verifyOtp({ ...request, body: validated } as any, reply);
    }
  );

  // Password Reset - Request OTP
  fastify.post(
    '/api/auth/password-reset/request',
    {
      schema: {
        description: 'Request password reset - sends SMS OTP to registered mobile number. Returns success even if email doesn\'t exist (security best practice).',
        tags: ['Auth'],
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
      const validated = passwordResetRequestSchema.parse(request.body);
      return authController.requestPasswordReset({ ...request, body: validated } as any, reply);
    }
  );

  // Password Reset - Verify OTP and Reset Password
  fastify.post(
    '/api/auth/password-reset/verify',
    {
      schema: {
        description: 'Verify password reset OTP and set new password',
        tags: ['Auth'],
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
      const validated = passwordResetVerifySchema.parse(request.body);
      return authController.verifyPasswordReset({ ...request, body: validated } as any, reply);
    }
  );

  // Logout
  fastify.post(
    '/api/auth/logout',
    {
      preHandler: [authenticate], // Require authentication
      schema: {
        description: 'Logout user. Requires authentication token.',
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            description: 'Success - Logged out successfully',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
          401: {
            description: 'Unauthorized - Invalid user session or authentication required',
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              error: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Authentication required' },
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
      return authController.logout(request, reply);
    }
  );
}

