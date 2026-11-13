// ============================================================================
// Portfolio Module - Routes  (mounted at /api/v1/portfolio)
// ============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { AppError } from '../../core/errors/AppError';
import { validateRequest } from '../../core/middleware/validate';
import { PortfolioController as C } from './portfolio.controller';
import { requireAdmin } from './portfolio.auth';
import { isPortfolioConfigured } from './portfolio.db';
import { imageUpload, pdfUpload, singleFile } from './portfolio.storage';
import {
  contactSchema,
  deleteManySchema,
  idParamSchema,
  loginSchema,
  projectDraftSchema,
  reorderSchema,
  testimonialSchema,
  testimonialUpdateSchema,
} from './portfolio.validation';

const router = Router();

// Without its database + JWT secret the module stays off instead of breaking the backend.
router.use((_req: Request, _res: Response, next: NextFunction) => {
  if (!isPortfolioConfigured()) {
    return next(
      new AppError(
        'Portfolio API is not configured (PORTFOLIO_MONGODB_URI / PORTFOLIO_JWT_SECRET).',
        503,
        'SERVICE_UNAVAILABLE',
      ),
    );
  }
  return next();
});

const tooMany = (message: string) => (_req: Request, _res: Response, next: NextFunction) =>
  next(new AppError(message, 429, 'RATE_LIMIT_EXCEEDED'));

// Slows down password guessing: 10 failed logins per 15 minutes per IP.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooMany('Too many login attempts. Try again in 15 minutes.'),
});

// Public forms: 5 submissions per 10 minutes per IP.
const formLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooMany('You’ve sent several already. Try again in a few minutes.'),
});

const byId = validateRequest({ params: idParamSchema });

// Auth
router.post('/auth/login', loginLimiter, validateRequest({ body: loginSchema }), C.login);
router.get('/auth/me', requireAdmin, C.me);

// Projects (static paths before "/:id")
router.get('/projects', C.listProjects);
router.get('/projects/admin', requireAdmin, C.listAllProjects);
router.put('/projects/reorder', requireAdmin, validateRequest({ body: reorderSchema }), C.reorderProjects);
// AI drafting: 20 drafts per 10 minutes, admin only
const aiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooMany('Too many AI drafts in a short time. Try again in a few minutes.'),
});
router.post('/projects/ai-draft', requireAdmin, aiLimiter, validateRequest({ body: projectDraftSchema }), C.draftProject);
router.get('/projects/:idOrSlug', C.getProject);
router.post('/projects', requireAdmin, singleFile(imageUpload, 'image'), C.createProject);
router.put('/projects/:id', requireAdmin, byId, singleFile(imageUpload, 'image'), C.updateProject);
router.delete('/projects/:id', requireAdmin, byId, C.deleteProject);

// Resume
router.get('/resume', C.getActiveResume);
router.get('/resume/all', requireAdmin, C.listResumes);
router.post('/resume', requireAdmin, singleFile(pdfUpload, 'resume'), C.uploadResume);
router.put('/resume/:id/active', requireAdmin, byId, C.activateResume);

// Reviews
router.get('/testimonials', C.listApprovedTestimonials);
router.post('/testimonials', formLimiter, validateRequest({ body: testimonialSchema }), C.submitTestimonial);
router.get('/testimonials/admin', requireAdmin, C.listAllTestimonials);
router.put('/testimonials/:id', requireAdmin, byId, validateRequest({ body: testimonialUpdateSchema }), C.updateTestimonial);
router.delete('/testimonials/:id', requireAdmin, byId, C.deleteTestimonial);

// Live sitemap for the portfolio site
router.get('/sitemap.xml', C.sitemap);

// Contact
router.post('/contact', formLimiter, validateRequest({ body: contactSchema }), C.submitContact);
router.get('/contact', requireAdmin, C.listMessages);
router.delete('/contact', requireAdmin, validateRequest({ body: deleteManySchema }), C.deleteMessages);

export const portfolioRoutes = router;
