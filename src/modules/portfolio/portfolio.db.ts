// ============================================================================
// Portfolio Module - Database
// ----------------------------------------------------------------------------
// The portfolio keeps its data in its own MongoDB Atlas cluster (projects,
// reviews, messages, resume history, admin account). This module opens a
// separate connection to it, so nothing had to be migrated into the main
// "aditya-backend" database.
// ============================================================================

import mongoose, { Connection } from 'mongoose';
import { env } from '../../config/env';
import { logger } from '../../core/utils/logger';

let connection: Connection | null = null;

/** The module needs its database and a JWT secret; without them its routes answer 503. */
export const isPortfolioConfigured = (): boolean =>
  Boolean(env.PORTFOLIO_MONGODB_URI && env.PORTFOLIO_JWT_SECRET);

export const getPortfolioConnection = (): Connection => {
  if (!env.PORTFOLIO_MONGODB_URI) {
    throw new Error('PORTFOLIO_MONGODB_URI is not set');
  }
  if (!connection) {
    connection = mongoose.createConnection(env.PORTFOLIO_MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
      autoIndex: env.NODE_ENV !== 'production',
    });
    connection.on('connected', () => logger.info('Portfolio MongoDB connection established'));
    connection.on('error', (err) => logger.error({ err }, 'Portfolio MongoDB connection error'));
    connection.on('disconnected', () => logger.warn('Portfolio MongoDB disconnected'));
  }
  return connection;
};
