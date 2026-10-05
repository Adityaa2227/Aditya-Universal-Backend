import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { requestLogger } from './core/middleware/requestLogger';
import { apiRateLimiter } from './core/middleware/rateLimiter';
import { errorHandler } from './core/errors/errorHandler';
import { AppError } from './core/errors/AppError';
import { healthRoutes } from './modules/health/health.routes';
import { routes } from './routes';
import { swaggerDocument } from './docs/swagger';

const createApp = (): Express => {
  const app = express();

  // Trust Render / proxy headers for rate limiting and IP tracking
  app.set('trust proxy', 1);

  // Security Headers via Helmet
  app.use(
    helmet({
      contentSecurityPolicy: false, // Allows Swagger UI to load its assets smoothly
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Configurable CORS
  const allowedOrigins =
    env.CORS_ORIGINS === '*'
      ? '*'
      : env.CORS_ORIGINS.split(',').map((origin) => origin.trim().toLowerCase());

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins === '*') {
          return callback(null, true);
        }
        if (allowedOrigins.includes(origin.toLowerCase())) {
          return callback(null, true);
        }
        return callback(new AppError('Blocked by CORS policy', 403, 'FORBIDDEN'));
      },
      credentials: allowedOrigins !== '*',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'x-request-id'],
      exposedHeaders: ['X-Request-Id'],
    }),
  );

  // Request body parsing with strict size limits
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Structured request logging
  app.use(requestLogger);

  // Health check route (used by Render and uptime monitors)
  app.use('/health', healthRoutes);

  // Interactive Swagger UI documentation
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerDocument, {
      customSiteTitle: 'Aditya Backend - API Documentation',
      customCss: '.swagger-ui .topbar { display: none }',
    }),
  );

  // Versioned API routes with general rate limiter
  app.use('/api', apiRateLimiter, routes);

  // Catch-all 404 for undefined routes
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(
      AppError.notFound(
        `Route ${req.method} ${req.originalUrl} not found on Aditya Backend`,
        'RESOURCE_NOT_FOUND',
      ),
    );
  });

  // Centralized Error Handling Middleware
  app.use(errorHandler);

  return app;
};

export const app = createApp();
