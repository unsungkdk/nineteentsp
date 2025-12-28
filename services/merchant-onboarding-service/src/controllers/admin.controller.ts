import { FastifyRequest, FastifyReply } from 'fastify';
import { 
  adminService, 
  AdminSignInInput,
  UpdateMerchantProfileInput,
  AdminPasswordResetRequestInput,
  AdminPasswordResetVerifyInput,
  GetAuditLogsInput,
} from '../services/admin.service';
import { logger, AppError, formatErrorResponse } from '@tsp/common';

export const adminController = {
  /**
   * POST /api/admin/signin
   * 
   * Response Codes:
   * - 200 OK: Sign in successful, returns token
   * - 401 Unauthorized: Invalid email or password
   * - 403 Forbidden: Admin account is disabled
   * - 500 Internal Server Error: Unexpected server error
   */
  async signIn(request: FastifyRequest<{ Body: AdminSignInInput }>, reply: FastifyReply) {
    try {
      const result = await adminService.signIn(request.body);
      return reply.status(200).send(result);
    } catch (error: any) {
      logger.error('[Admin Controller] Sign in error:', error);
      
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
   * GET /api/admin/merchants
   * 
   * Response Codes:
   * - 200 OK: Returns list of merchants
   * - 401 Unauthorized: Invalid or missing authentication token
   * - 500 Internal Server Error: Unexpected server error
   */
  async getAllMerchants(request: FastifyRequest, reply: FastifyReply) {
    try {
      const page = parseInt((request.query as any)?.page || '1', 10);
      const limit = parseInt((request.query as any)?.limit || '20', 10);
      const search = (request.query as any)?.search;

      const result = await adminService.getAllMerchants(page, limit, search);
      return reply.status(200).send(result);
    } catch (error: any) {
      logger.error('[Admin Controller] Get all merchants error:', error);
      
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
   * GET /api/admin/merchants/:merchantId
   * 
   * Response Codes:
   * - 200 OK: Returns merchant details
   * - 401 Unauthorized: Invalid or missing authentication token
   * - 404 Not Found: Merchant not found
   * - 500 Internal Server Error: Unexpected server error
   */
  async getMerchantById(request: FastifyRequest<{ Params: { merchantId: string } }>, reply: FastifyReply) {
    try {
      const { merchantId } = request.params;
      const result = await adminService.getMerchantById(merchantId);
      return reply.status(200).send(result);
    } catch (error: any) {
      logger.error('[Admin Controller] Get merchant by ID error:', error);
      
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
   * PUT /api/admin/merchants/:merchantId/profile
   * 
   * Response Codes:
   * - 200 OK: Profile updated successfully
   * - 400 Bad Request: Validation error
   * - 401 Unauthorized: Invalid or missing authentication token
   * - 404 Not Found: Merchant not found
   * - 500 Internal Server Error: Unexpected server error
   */
  async updateMerchantProfile(
    request: FastifyRequest<{ 
      Params: { merchantId: string };
      Body: UpdateMerchantProfileInput;
    }>, 
    reply: FastifyReply
  ) {
    try {
      const { merchantId } = request.params;
      const result = await adminService.updateMerchantProfile(merchantId, request.body);
      return reply.status(200).send(result);
    } catch (error: any) {
      logger.error('[Admin Controller] Update merchant profile error:', error);
      
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
   * POST /api/admin/merchants/:merchantId/disable
   * 
   * Response Codes:
   * - 200 OK: Merchant account disabled successfully
   * - 401 Unauthorized: Invalid or missing authentication token
   * - 404 Not Found: Merchant not found
   * - 500 Internal Server Error: Unexpected server error
   */
  async disableMerchantAccount(
    request: FastifyRequest<{ Params: { merchantId: string } }>, 
    reply: FastifyReply
  ) {
    try {
      const { merchantId } = request.params;
      const result = await adminService.disableMerchantAccount(merchantId);
      return reply.status(200).send(result);
    } catch (error: any) {
      logger.error('[Admin Controller] Disable merchant account error:', error);
      
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
   * POST /api/admin/merchants/:merchantId/enable
   * 
   * Response Codes:
   * - 200 OK: Merchant account enabled successfully
   * - 401 Unauthorized: Invalid or missing authentication token
   * - 404 Not Found: Merchant not found
   * - 500 Internal Server Error: Unexpected server error
   */
  async enableMerchantAccount(
    request: FastifyRequest<{ Params: { merchantId: string } }>, 
    reply: FastifyReply
  ) {
    try {
      const { merchantId } = request.params;
      const result = await adminService.enableMerchantAccount(merchantId);
      return reply.status(200).send(result);
    } catch (error: any) {
      logger.error('[Admin Controller] Enable merchant account error:', error);
      
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
   * POST /api/admin/password-reset/request
   * 
   * Response Codes:
   * - 200 OK: Password reset OTP sent successfully (even if email doesn't exist - security)
   * - 400 Bad Request: Validation error (mobile not registered)
   * - 503 Service Unavailable: SMS service temporarily unavailable
   * - 500 Internal Server Error: Unexpected server error
   */
  async requestPasswordReset(request: FastifyRequest<{ Body: AdminPasswordResetRequestInput }>, reply: FastifyReply) {
    try {
      const result = await adminService.requestPasswordReset(request.body);
      return reply.status(200).send(result);
    } catch (error: any) {
      logger.error('[Admin Controller] Request password reset error:', error);
      
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
   * POST /api/admin/password-reset/verify
   * 
   * Response Codes:
   * - 200 OK: Password reset successfully
   * - 400 Bad Request: Validation error (invalid password format, invalid OTP format)
   * - 401 Unauthorized: Invalid or expired OTP
   * - 404 Not Found: Admin not found
   * - 500 Internal Server Error: Unexpected server error
   */
  async verifyPasswordReset(request: FastifyRequest<{ Body: AdminPasswordResetVerifyInput }>, reply: FastifyReply) {
    try {
      const result = await adminService.verifyPasswordReset(request.body);
      return reply.status(200).send(result);
    } catch (error: any) {
      logger.error('[Admin Controller] Verify password reset error:', error);
      
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
   * GET /api/admin/audit-logs
   * 
   * Response Codes:
   * - 200 OK: Returns audit logs with pagination
   * - 401 Unauthorized: Invalid or missing authentication token
   * - 500 Internal Server Error: Unexpected server error
   */
  async getAuditLogs(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as any;
      const filters: GetAuditLogsInput = {
        page: query.page ? parseInt(query.page, 10) : undefined,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        merchantId: query.merchantId,
        userId: query.userId ? parseInt(query.userId, 10) : undefined,
        email: query.email,
        actionType: query.actionType,
        ipAddress: query.ipAddress,
        startDate: query.startDate,
        endDate: query.endDate,
        responseStatus: query.responseStatus ? parseInt(query.responseStatus, 10) : undefined,
        sessionId: query.sessionId,
      };

      const result = await adminService.getAuditLogs(filters);
      return reply.status(200).send(result);
    } catch (error: any) {
      logger.error('[Admin Controller] Get audit logs error:', error);
      
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
   * GET /api/admin/audit-logs/export
   * 
   * Response Codes:
   * - 200 OK: Returns audit logs as .txt file
   * - 401 Unauthorized: Invalid or missing authentication token
   * - 500 Internal Server Error: Unexpected server error
   */
  async exportAuditLogs(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as any;
      const filters: GetAuditLogsInput = {
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        merchantId: query.merchantId,
        userId: query.userId ? parseInt(query.userId, 10) : undefined,
        email: query.email,
        actionType: query.actionType,
        ipAddress: query.ipAddress,
        startDate: query.startDate,
        endDate: query.endDate,
        responseStatus: query.responseStatus ? parseInt(query.responseStatus, 10) : undefined,
        sessionId: query.sessionId,
      };

      const reportText = await adminService.exportAuditLogs(filters);
      
      const filename = `audit-logs-${new Date().toISOString().split('T')[0]}.txt`;
      
      return reply
        .type('text/plain')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(reportText);
    } catch (error: any) {
      logger.error('[Admin Controller] Export audit logs error:', error);
      
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

