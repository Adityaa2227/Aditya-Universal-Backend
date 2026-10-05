import { Request, Response, NextFunction } from 'express';
import { ApiKeyService } from './apiKey.service';
import { sendCreated, sendSuccess } from '../../core/utils/response';

export class ApiKeyController {
  public static async createKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await ApiKeyService.createApiKey(req.body, req.user?.userId);
      sendCreated(
        res,
        result,
        'API key generated successfully. Store it safely, as it will NOT be shown again.',
      );
    } catch (error) {
      next(error);
    }
  }

  public static async listKeys(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const project = req.query.project as string | undefined;
      const keys = await ApiKeyService.listApiKeys(project);
      sendSuccess(res, keys, 'API keys fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async revokeKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const revoked = await ApiKeyService.revokeApiKey(req.params.id);
      sendSuccess(res, revoked, 'API key revoked successfully');
    } catch (error) {
      next(error);
    }
  }
}
