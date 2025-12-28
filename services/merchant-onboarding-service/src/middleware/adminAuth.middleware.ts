import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken, generateToken, shouldRefreshToken, JWTPayload } from '@tsp/common';
import { UnauthorizedError, ForbiddenError } from '@tsp/common';

// Extend FastifyRequest to include admin user
declare module 'fastify' {
  interface FastifyRequest {
    admin?: JWTPayload & { role: string };
  }
}

/**
 * Admin authentication middleware
 * - Validates JWT token
 * - Checks if user is admin (role must be 'admin' or 'super_admin')
 * - Refreshes token if close to expiry (sliding session)
 * - Attaches admin payload to request
 */
export const authenticateAdmin = async (
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
    
    // Check if user is admin (role must be admin or super_admin)
    if (payload.role !== 'admin' && payload.role !== 'super_admin' && payload.role !== 'support') {
      throw new ForbiddenError('Admin access required');
    }

    // Check if admin is active
    if (!payload.isActive) {
      throw new ForbiddenError('Admin account is inactive');
    }

    // Attach admin to request
    request.admin = payload as JWTPayload & { role: string };

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

