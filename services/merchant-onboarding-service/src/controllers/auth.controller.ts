import { FastifyRequest, FastifyReply } from 'fastify';
import { authService, SignUpInput, SignInInput, SendOtpInput, VerifyOtpInput } from '../services/auth.service';
import { logger } from '@tsp/common';

export const authController = {
  /**
   * POST /api/auth/signup
   */
  async signUp(request: FastifyRequest<{ Body: SignUpInput }>, reply: FastifyReply) {
    try {
      const result = await authService.signUp(request.body);
      return reply.status(201).send(result);
    } catch (error: any) {
      logger.error('Sign up error:', error);
      const statusCode = error.statusCode || 500;
      return reply.status(statusCode).send({
        success: false,
        error: error.message,
      });
    }
  },

  /**
   * POST /api/auth/signin
   */
  async signIn(request: FastifyRequest<{ Body: SignInInput }>, reply: FastifyReply) {
    try {
      const result = await authService.signIn(request.body);
      return reply.status(200).send(result);
    } catch (error: any) {
      logger.error('Sign in error:', error);
      const statusCode = error.statusCode || 500;
      return reply.status(statusCode).send({
        success: false,
        error: error.message,
      });
    }
  },

  /**
   * POST /api/auth/send-otp
   */
  async sendOtp(request: FastifyRequest<{ Body: SendOtpInput }>, reply: FastifyReply) {
    try {
      const result = await authService.sendOtp(request.body);
      return reply.status(200).send(result);
    } catch (error: any) {
      logger.error('Send OTP error:', error);
      const statusCode = error.statusCode || 500;
      return reply.status(statusCode).send({
        success: false,
        error: error.message,
      });
    }
  },

  /**
   * POST /api/auth/verify-otp
   */
  async verifyOtp(request: FastifyRequest<{ Body: VerifyOtpInput }>, reply: FastifyReply) {
    try {
      const result = await authService.verifyOtp(request.body);
      return reply.status(200).send(result);
    } catch (error: any) {
      logger.error('Verify OTP error:', error);
      const statusCode = error.statusCode || 500;
      return reply.status(statusCode).send({
        success: false,
        error: error.message,
      });
    }
  },
};

