import { Router } from 'express';
import { AuthController } from './auth.controller';
import { validateRequest } from '../../core/middleware/validate';
import { registerSchema, loginSchema } from './auth.validation';
import { requireAuth } from '../../core/middleware/auth';
import { authRateLimiter } from '../../core/middleware/rateLimiter';

const router = Router();

router.post(
  '/register',
  authRateLimiter,
  validateRequest({ body: registerSchema }),
  AuthController.register,
);

router.post(
  '/login',
  authRateLimiter,
  validateRequest({ body: loginSchema }),
  AuthController.login,
);

router.get('/me', requireAuth, AuthController.getMe);

export const authRoutes = router;
