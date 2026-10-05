import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);

  const startTime = process.hrtime();

  res.on('finish', () => {
    const diff = process.hrtime(startTime);
    const responseTimeMs = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);
    const statusCode = res.statusCode;

    const logData = {
      requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      statusCode,
      responseTime: `${responseTimeMs}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    };

    if (statusCode >= 500) {
      logger.error(logData, `HTTP ${req.method} ${req.originalUrl || req.url} ${statusCode}`);
    } else if (statusCode >= 400) {
      logger.warn(logData, `HTTP ${req.method} ${req.originalUrl || req.url} ${statusCode}`);
    } else {
      logger.info(logData, `HTTP ${req.method} ${req.originalUrl || req.url} ${statusCode}`);
    }
  });

  next();
};
