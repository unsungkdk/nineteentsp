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
    
    // Create user-friendly error messages from validation errors
    const validationMessages = error.validation.map((err: any) => {
      const field = err.instancePath?.replace('/', '') || err.params?.missingProperty || 'field';
      let message = '';
      
      if (err.keyword === 'format') {
        if (field === 'email') {
          message = 'Please provide a valid email address';
        } else {
          message = `${field} format is invalid`;
        }
      } else if (err.keyword === 'required') {
        message = `${field} is required`;
      } else if (err.keyword === 'enum') {
        message = `${field} must be one of: ${err.params?.allowedValues?.join(', ')}`;
      } else if (err.keyword === 'minLength') {
        message = `${field} cannot be empty`;
      } else {
        message = err.message || 'Validation error';
      }
      
      return message;
    });
    
    const primaryMessage = validationMessages[0] || 'Validation error';
    
    reply.status(400).send({
      success: false,
      error: {
        message: primaryMessage,
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

