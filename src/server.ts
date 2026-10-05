import { Server } from 'http';
import { app } from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { logger } from './core/utils/logger';

let server: Server;

const startServer = async (): Promise<void> => {
  try {
    // 1. Connect to MongoDB Atlas
    await connectDatabase();

    // 2. Start HTTP server
    server = app.listen(env.PORT, () => {
      logger.info(`🚀 Aditya Backend running in [${env.NODE_ENV}] mode on port ${env.PORT}`);
      logger.info(`📖 API Documentation available at http://localhost:${env.PORT}/api-docs`);
      logger.info(`💓 Health check available at http://localhost:${env.PORT}/health`);
    });
  } catch (error) {
    logger.fatal({ error }, 'Failed to start server');
    process.exit(1);
  }
};

// Graceful Shutdown Handler
const shutdown = async (signal: string): Promise<void> => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed, no longer accepting connections.');
      try {
        await disconnectDatabase();
        logger.info('Graceful shutdown completed.');
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error during database disconnection');
        process.exit(1);
      }
    });

    // Force shutdown after timeout if connections hang
    setTimeout(() => {
      logger.error('Forced shutdown due to timeout.');
      process.exit(1);
    }, 10000).unref();
  } else {
    process.exit(0);
  }
};

// Process termination signal handlers (Render sends SIGTERM upon deployment/stop)
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled Promise Rejection detected');
  shutdown('unhandledRejection');
});

process.on('uncaughtException', (error) => {
  logger.fatal({ error }, 'Uncaught Exception detected');
  shutdown('uncaughtException');
});

// Start the server
startServer();
