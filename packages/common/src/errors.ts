export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, `${resource} not found`);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(403, message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests') {
    super(429, message);
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message: string) {
    super(422, message);
  }
}

/**
 * Precondition Required Error (428)
 * Used when account verification is required before access
 */
export class PreconditionRequiredError extends AppError {
  constructor(message: string, public verificationType?: 'both' | 'email' | 'mobile') {
    super(428, message);
  }
}

/**
 * Standardized error response format
 */
export interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    statusCode: number;
    details?: any;
  };
}

/**
 * Format error for API response
 */
export const formatErrorResponse = (error: AppError): ErrorResponse => {
  return {
    success: false,
    error: {
      message: error.message,
      statusCode: error.statusCode,
    },
  };
}

