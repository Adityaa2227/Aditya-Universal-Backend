import { Request, Response, NextFunction } from 'express';
import { ApiKeyService } from '../../modules/apiKey/apiKey.service';
import { AppError } from '../errors/AppError';
import { ApiKeyPayload } from '../types';

export const requireApiKey = (requiredPermission?: string) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const apiKeyHeader =
        (req.headers['x-api-key'] as string) || (req.headers['X-API-Key'] as string);

      if (!apiKeyHeader) {
        throw AppError.unauthorized('API key is missing in X-API-Key header', 'INVALID_API_KEY');
      }

      const keyDoc = await ApiKeyService.validateKey(apiKeyHeader);

      if (requiredPermission) {
        const hasPermission =
          keyDoc.permissions.includes('*') || keyDoc.permissions.includes(requiredPermission);

        if (!hasPermission) {
          throw AppError.forbidden(
            `API key lacks the required permission: ${requiredPermission}`,
            'FORBIDDEN',
          );
        }
      }

      const apiKeyPayload: ApiKeyPayload = {
        keyId: keyDoc._id.toString(),
        name: keyDoc.name,
        project: keyDoc.project,
        permissions: keyDoc.permissions,
      };

      req.apiKey = apiKeyPayload;
      next();
    } catch (error) {
      next(error);
    }
  };
};
