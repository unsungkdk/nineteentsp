import { FastifyRequest, FastifyReply } from 'fastify';
import { 
  authService, 
  SignUpInput, 
  SignInInput, 
  SendOtpInput, 
  VerifyOtpInput,
  PasswordResetRequestInput,
  PasswordResetVerifyInput,
  LogoutInput,
} from '../services/auth.service';
import { logger, AppError, formatErrorResponse } from '@tsp/common';

export const authController = {
  /**
   * POST /api/auth/signup
   * 
   * Response Codes:
   * - 201 Created: Merchant account created successfully
   * - 400 Bad Request: Validation error
   * - 409 Conflict: Email or mobile already registered
   * - 500 Internal Server Error: Unexpected server error
   */
  async signUp(request: FastifyRequest<{ Body: SignUpInput }>, reply: FastifyReply) {
    try {
      const result = await authService.signUp(request.body);
      return reply.status(201).send(result);
    } catch (error: any) {
      logger.error('[Auth Controller] Sign up error:', error);
      
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
  },

  /**
   * POST /api/auth/signin
   * 
   * Response Codes:
   * - 200 OK: Password valid, OTP verification required (returns requiresOtp: true)
   * - 401 Unauthorized: Invalid email or password
   * - 422 Unprocessable Entity: Account in invalid state
   * - 503 Service Unavailable: SMS/Email service temporarily unavailable
   * - 500 Internal Server Error: Unexpected server error
   */
  async signIn(request: FastifyRequest<{ Body: SignInInput }>, reply: FastifyReply) {
    try {
      const result = await authService.signIn(request.body);
      
      // If OTP is required, return 200 OK with requiresOtp flag
      // If token is present, authentication is complete
      return reply.status(200).send(result);
    } catch (error: any) {
      logger.error('[Auth Controller] Sign in error:', error);
      
      // Use standardized error response format
      if (error instanceof AppError) {
        const errorResponse = formatErrorResponse(error);
        return reply.status(error.statusCode || 500).send(errorResponse);
      }
      
      // Unknown error - return 500
      return reply.status(500).send({
        success: false,
        error: {
          message: 'Internal server error',
          statusCode: 500,
        },
      });
    }
  },

  /**
   * POST /api/auth/send-otp
   * 
   * Response Codes:
   * - 200 OK: OTP sent successfully
   * - 400 Bad Request: Validation error or invalid OTP type
   * - 404 Not Found: Merchant not found
   * - 503 Service Unavailable: SMS/Email service temporarily unavailable
   * - 500 Internal Server Error: Unexpected server error
   */
  async sendOtp(request: FastifyRequest<{ Body: SendOtpInput }>, reply: FastifyReply) {
    try {
      const result = await authService.sendOtp(request.body);
      return reply.status(200).send(result);
    } catch (error: any) {
      logger.error('[Auth Controller] Send OTP error:', error);
      
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
  },

  /**
   * POST /api/auth/verify-otp
   * 
   * Response Codes:
   * - 200 OK: OTP verified successfully (returns token if authentication complete, or requiresOtp if more verification needed)
   * - 400 Bad Request: Validation error or invalid OTP
   * - 401 Unauthorized: Invalid/expired OTP, invalid/expired MFA session, or too many attempts
   * - 404 Not Found: Merchant not found
   * - 422 Unprocessable Entity: Invalid OTP type for MFA login (e.g., email OTP for MFA-only login)
   * - 500 Internal Server Error: Unexpected server error
   */
  async verifyOtp(request: FastifyRequest<{ Body: VerifyOtpInput }>, reply: FastifyReply) {
    try {
      const result = await authService.verifyOtp(request.body);
      return reply.status(200).send(result);
    } catch (error: any) {
      logger.error('[Auth Controller] Verify OTP error:', error);
      
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
  },

  /**
   * POST /api/auth/password-reset/request
   * 
   * Response Codes:
   * - 200 OK: Password reset OTP sent successfully (even if email doesn't exist - security)
   * - 400 Bad Request: Validation error
   * - 503 Service Unavailable: SMS service temporarily unavailable
   * - 500 Internal Server Error: Unexpected server error
   */
  async requestPasswordReset(request: FastifyRequest<{ Body: PasswordResetRequestInput }>, reply: FastifyReply) {
    try {
      const result = await authService.requestPasswordReset(request.body);
      return reply.status(200).send(result);
    } catch (error: any) {
      logger.error('[Auth Controller] Request password reset error:', error);
      
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
  },

  /**
   * POST /api/auth/password-reset/verify
   * 
   * Response Codes:
   * - 200 OK: Password reset successfully
   * - 400 Bad Request: Validation error (invalid password format, invalid OTP format)
   * - 401 Unauthorized: Invalid or expired OTP
   * - 404 Not Found: Merchant not found
   * - 500 Internal Server Error: Unexpected server error
   */
  async verifyPasswordReset(request: FastifyRequest<{ Body: PasswordResetVerifyInput }>, reply: FastifyReply) {
    try {
      const result = await authService.verifyPasswordReset(request.body);
      return reply.status(200).send(result);
    } catch (error: any) {
      logger.error('[Auth Controller] Verify password reset error:', error);
      
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
  },

  /**
   * POST /api/auth/logout
   * 
   * Response Codes:
   * - 200 OK: Logged out successfully
   * - 401 Unauthorized: Invalid user session or authentication required
   * - 500 Internal Server Error: Unexpected server error
   */
  async logout(request: FastifyRequest, reply: FastifyReply) {
    try {
      // Get user from request (set by auth middleware)
      const user = (request as any).user;
      
      if (!user || !user.email || !user.userId) {
        throw new AppError(401, 'Authentication required');
      }

      const result = await authService.logout(
        parseInt(user.userId),
        user.email
      );
      
      return reply.status(200).send(result);
    } catch (error: any) {
      logger.error('[Auth Controller] Logout error:', error);
      
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
  },
};

