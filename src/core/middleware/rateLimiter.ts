import rateLimit from 'express-rate-limit';
import { env } from '../../config/env';
import { AppError } from '../errors/AppError';

export const apiRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new AppError('Too many requests, please try again later.', 429, 'RATE_LIMIT_EXCEEDED'));
  },
  skip: () => env.NODE_ENV === 'test', // Skip in tests
});

export const authRateLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(
      new AppError(
        'Too many authentication attempts, please try again later.',
        429,
        'RATE_LIMIT_EXCEEDED',
      ),
    );
  },
  skip: () => env.NODE_ENV === 'test',
});
