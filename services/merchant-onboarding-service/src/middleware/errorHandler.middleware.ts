import { FastifyRequest, FastifyReply, FastifyError } from 'fastify';
import { AppError, formatErrorResponse, logger } from '@tsp/common';

/**
 * Global error handler middleware
 * Formats errors consistently and returns proper HTTP status codes
 */
export const errorHandler = (
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): void => {
  // Log error
  logger.error(`[Error Handler] ${error.message}`, {
    statusCode: error.statusCode,
    path: request.url,
    method: request.method,
    stack: error.stack,
  });

  // If it's an AppError (our custom error), use its status code
  if (error instanceof AppError) {
    const errorResponse = formatErrorResponse(error);
    reply.status(error.statusCode || 500).send(errorResponse);
    return;
  }

  // Fastify validation errors
  if (error.validation) {
    // Log the request body to help debug validation issues
    logger.error('[Error Handler] Validation error - Request body:', {
      body: request.body,
      params: request.params,
      query: request.query,
      validation: error.validation,
      path: request.url,
      method: request.method,
    });
    
    reply.status(400).send({
      success: false,
      error: {
        message: 'Validation error',
        statusCode: 400,
        details: error.validation,
      },
    });
    return;
  }

  // Default to 500 for unknown errors
  const statusCode = error.statusCode || 500;
  
  // Don't expose internal errors in production
  const message = statusCode === 500 && process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : error.message;

  reply.status(statusCode).send({
    success: false,
    error: {
      message,
      statusCode,
    },
  });
};

