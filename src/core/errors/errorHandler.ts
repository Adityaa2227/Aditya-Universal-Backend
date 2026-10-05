import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from './AppError';
import { logger } from '../utils/logger';
import { env } from '../../config/env';

interface MongooseError extends Error {
  name: string;
  code?: number;
  keyValue?: Record<string, unknown>;
  path?: string;
  value?: unknown;
}

export const errorHandler = (
  err: Error | AppError | ZodError | MongooseError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): Response => {
  // 1. Operational AppError
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, path: req.path, method: req.method }, 'Operational Server Error');
    }

    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
  }

  // 2. Zod Validation Error
  if (err instanceof ZodError) {
    const formattedErrors = err.errors.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));

    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: formattedErrors,
      },
    });
  }

  // 3. Mongoose Duplicate Key Error (E11000)
  const mgErr = err as MongooseError;
  if (mgErr.code === 11000 && mgErr.keyValue) {
    const keys = Object.keys(mgErr.keyValue).join(', ');
    return res.status(409).json({
      success: false,
      error: {
        code: 'RESOURCE_CONFLICT',
        message: `Resource with duplicate key (${keys}) already exists`,
      },
    });
  }

  // 4. Mongoose Invalid ObjectId (CastError)
  if (mgErr.name === 'CastError' && mgErr.path) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: `Invalid value for parameter: ${mgErr.path}`,
      },
    });
  }

  // 5. Body Parser JSON Syntax Error
  if (err instanceof SyntaxError && 'status' in err && (err as { status: number }).status === 400) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Malformed JSON payload in request body',
      },
    });
  }

  // 6. Unknown / Unhandled Errors (500)
  logger.error(
    {
      err: {
        name: err.name,
        message: err.message,
        stack: err.stack,
      },
      path: req.path,
      method: req.method,
      ip: req.ip,
    },
    'Unhandled Server Exception',
  );

  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message:
        env.NODE_ENV === 'production'
          ? 'An unexpected error occurred. Please try again later.'
          : err.message || 'Internal server error',
    },
  });
};
