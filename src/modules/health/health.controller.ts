import { Request, Response } from 'express';
import { isDatabaseConnected } from '../../config/database';

export class HealthController {
  public static getHealth(_req: Request, res: Response): Response {
    const dbConnected = isDatabaseConnected();
    const status = dbConnected ? 'ok' : 'degraded';
    const statusCode = dbConnected ? 200 : 503;

    return res.status(statusCode).json({
      success: dbConnected,
      status,
      database: dbConnected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    });
  }
}
