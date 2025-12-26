import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authController } from '../controllers/auth.controller';

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
});

const sendOtpSchema = z.object({
  email: z.string().email(),
  otpType: z.enum(['email', 'mobile', 'sms']),
});

const verifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
  otpType: z.enum(['email', 'mobile', 'sms']),
});

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
        description: 'Sign in merchant',
        tags: ['Auth'],
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
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              token: { type: 'string' },
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
            email: { type: 'string', format: 'email' },
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
        description: 'Verify OTP and get token',
        tags: ['Auth'],
        body: {
          type: 'object',
          required: ['email', 'otp', 'otpType'],
          properties: {
            email: { type: 'string', format: 'email' },
            otp: { type: 'string', minLength: 6, maxLength: 6 },
            otpType: { type: 'string', enum: ['email', 'mobile', 'sms'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              token: { type: 'string' },
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
      const validated = verifyOtpSchema.parse(request.body);
      return authController.verifyOtp({ ...request, body: validated } as any, reply);
    }
  );
}

