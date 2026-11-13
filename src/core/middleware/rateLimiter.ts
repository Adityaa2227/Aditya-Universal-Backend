import { Request } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env';
import { AppError } from '../errors/AppError';

/**
 * Requests that skip the global per-IP limit:
 * - Portfolio website reads (GET) and analytics events. One visitor browsing the site
 *   makes many small requests, and visitors behind a shared IP (college, office) would
 *   otherwise share 100/min. These are cheap reads; analytics has its own limiter.
 * Portfolio writes (forms, login, AI, uploads) still count here and keep their own,
 * stricter limiters in the portfolio module.
 */
const isPortfolioRead = (req: Request): boolean =>
  req.path.startsWith('/v1/portfolio/') &&
  (req.method === 'GET' || req.method === 'HEAD' || req.path === '/v1/portfolio/analytics/event');

export const apiRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new AppError('Too many requests, please try again later.', 429, 'RATE_LIMIT_EXCEEDED'));
  },
  skip: (req) => env.NODE_ENV === 'test' || isPortfolioRead(req),
});
