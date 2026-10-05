export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'RESOURCE_NOT_FOUND'
  | 'RESOURCE_CONFLICT'
  | 'RATE_LIMIT_EXCEEDED'
  | 'BAD_REQUEST'
  | 'INVALID_API_KEY'
  | 'API_KEY_REVOKED'
  | 'DATABASE_ERROR'
  | 'INTERNAL_SERVER_ERROR';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode = 500,
    code: ErrorCode = 'INTERNAL_SERVER_ERROR',
    details?: unknown,
    isOperational = true,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, code: ErrorCode = 'BAD_REQUEST', details?: unknown): AppError {
    return new AppError(message, 400, code, details);
  }

  static unauthorized(message = 'Unauthorized access', code: ErrorCode = 'UNAUTHORIZED'): AppError {
    return new AppError(message, 401, code);
  }

  static forbidden(message = 'Forbidden access', code: ErrorCode = 'FORBIDDEN'): AppError {
    return new AppError(message, 403, code);
  }

  static notFound(
    message = 'Resource not found',
    code: ErrorCode = 'RESOURCE_NOT_FOUND',
  ): AppError {
    return new AppError(message, 404, code);
  }

  static conflict(
    message = 'Resource already exists',
    code: ErrorCode = 'RESOURCE_CONFLICT',
  ): AppError {
    return new AppError(message, 409, code);
  }

  static internal(message = 'Internal server error', details?: unknown): AppError {
    return new AppError(message, 500, 'INTERNAL_SERVER_ERROR', details, false);
  }
}
