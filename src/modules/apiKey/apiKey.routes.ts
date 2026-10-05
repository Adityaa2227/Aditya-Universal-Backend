import { Router } from 'express';
import { ApiKeyController } from './apiKey.controller';
import { validateRequest } from '../../core/middleware/validate';
import { createApiKeySchema, apiKeyParamsSchema } from './apiKey.validation';
import { requireAuth } from '../../core/middleware/auth';

const router = Router();

// Key management routes protected with JWT auth
router.post(
  '/',
  requireAuth,
  validateRequest({ body: createApiKeySchema }),
  ApiKeyController.createKey,
);

router.get('/', requireAuth, ApiKeyController.listKeys);

router.delete(
  '/:id',
  requireAuth,
  validateRequest({ params: apiKeyParamsSchema }),
  ApiKeyController.revokeKey,
);

export const apiKeyRoutes = router;
