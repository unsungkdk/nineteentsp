import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken, generateToken, shouldRefreshToken, JWTPayload } from '@tsp/common';
import { UnauthorizedError } from '@tsp/common';

// Extend FastifyRequest to include user
declare module 'fastify' {
  interface FastifyRequest {
    user?: JWTPayload;
  }
}

/**
 * Authentication middleware
 * - Validates JWT token
 * - Refreshes token if close to expiry (sliding session)
 * - Attaches user payload to request
 */
export const authenticate = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  try {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authorization token required');
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify token
    const payload = verifyToken(token);
    
    // Check if merchant is active
    if (!payload.isActive) {
      throw new UnauthorizedError('Merchant account is inactive');
    }

    // Attach user to request
    request.user = payload;

    // Check if token should be refreshed (sliding session)
    if (shouldRefreshToken(payload)) {
      // Generate new token with same payload
      const newToken = generateToken({
        userId: payload.userId,
        merchantId: payload.merchantId,
        role: payload.role,
        email: payload.email,
        kycVerified: payload.kycVerified,
        isActive: payload.isActive,
      });

      // Send new token in response header
      reply.header('X-New-Token', newToken);
    }
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      throw new UnauthorizedError('Invalid or expired token');
    }
    throw error;
  }
};

