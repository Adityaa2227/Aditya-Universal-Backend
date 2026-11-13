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
import { BlogController, postDraftSchema, postInputSchema } from './portfolio.blog';
import { coverInputSchema, generateCover } from './portfolio.images';
import {
  passwordChangeSchema,
  SettingsController,
  settingsInputSchema,
} from './portfolio.settings';
import { analyticsSummary, recordEvent } from './portfolio.analytics';
import { answerChat, chatInputSchema } from './portfolio.chat';
import { sendWeeklyReportNow, startWeeklyReportScheduler } from './portfolio.reports';
import { InviteController, inviteInputSchema } from './portfolio.invites';
import { captureServerErrors, ErrorsController, reportClientError } from './portfolio.errors';

const router = Router();

/** Passes errors from async handlers to the central error handler (Express 4 doesn't). */
const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };

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
router.put(
  '/projects/reorder',
  requireAdmin,
  validateRequest({ body: reorderSchema }),
  C.reorderProjects,
);
// AI drafting: 20 drafts per 10 minutes, admin only
const aiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooMany('Too many AI drafts in a short time. Try again in a few minutes.'),
});
router.post(
  '/projects/ai-draft',
  requireAdmin,
  aiLimiter,
  validateRequest({ body: projectDraftSchema }),
  C.draftProject,
);
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
router.post(
  '/testimonials',
  formLimiter,
  validateRequest({ body: testimonialSchema }),
  C.submitTestimonial,
);
router.get('/testimonials/admin', requireAdmin, C.listAllTestimonials);
router.put(
  '/testimonials/:id',
  requireAdmin,
  byId,
  validateRequest({ body: testimonialUpdateSchema }),
  C.updateTestimonial,
);
router.delete('/testimonials/:id', requireAdmin, byId, C.deleteTestimonial);
router.post('/testimonials/:id/ai-polish', requireAdmin, aiLimiter, byId, C.polishTestimonial);

// Live sitemap for the portfolio site
router.get('/sitemap.xml', C.sitemap);

// Contact
router.post('/contact', formLimiter, validateRequest({ body: contactSchema }), C.submitContact);
router.get('/contact', requireAdmin, C.listMessages);
router.delete(
  '/contact',
  requireAdmin,
  validateRequest({ body: deleteManySchema }),
  C.deleteMessages,
);
router.post('/contact/:id/ai-reply', requireAdmin, aiLimiter, byId, C.draftMessageReply);

// Image uploads for project galleries and blog covers
router.post('/uploads/image', requireAdmin, singleFile(imageUpload, 'image'), C.uploadImage);

// Site settings (open-to-work badge, contact auto-reply) and password change
router.get('/settings', wrap(SettingsController.get));
router.put(
  '/settings',
  requireAdmin,
  validateRequest({ body: settingsInputSchema }),
  wrap(SettingsController.update),
);
router.put(
  '/auth/password',
  requireAdmin,
  loginLimiter,
  validateRequest({ body: passwordChangeSchema }),
  wrap(SettingsController.changePassword),
);

// Blog (static paths before "/:slug")
router.get('/posts', wrap(BlogController.list));
router.get('/posts/admin', requireAdmin, wrap(BlogController.listAll));
router.post(
  '/posts/ai-draft',
  requireAdmin,
  aiLimiter,
  validateRequest({ body: postDraftSchema }),
  wrap(BlogController.aiDraft),
);
router.post(
  '/posts/ai-cover',
  requireAdmin,
  aiLimiter,
  validateRequest({ body: coverInputSchema }),
  wrap(generateCover),
);
router.get('/posts/:slug', wrap(BlogController.get));
router.post(
  '/posts',
  requireAdmin,
  validateRequest({ body: postInputSchema }),
  wrap(BlogController.create),
);
router.put(
  '/posts/:id',
  requireAdmin,
  byId,
  validateRequest({ body: postInputSchema }),
  wrap(BlogController.update),
);
router.delete('/posts/:id', requireAdmin, byId, wrap(BlogController.remove));

// Analytics: events from the site (generous limit), summary for the admin dashboard
const eventLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: false,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(204).end();
  },
});
router.post('/analytics/event', eventLimiter, recordEvent);
router.get('/analytics/summary', requireAdmin, wrap(analyticsSummary));

// "Ask my portfolio" chat: 20 questions per 10 minutes per visitor IP
const chatLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooMany(
    'You’ve asked a lot of questions quickly. Try again in a few minutes, or use the contact form.',
  ),
});
router.post('/chat', chatLimiter, validateRequest({ body: chatInputSchema }), wrap(answerChat));

// Weekly report: send now (for testing / on demand)
router.post('/reports/weekly/test', requireAdmin, aiLimiter, wrap(sendWeeklyReportNow));

// "Request a review" links
router.get('/review-invites', requireAdmin, wrap(InviteController.list));
router.post(
  '/review-invites',
  requireAdmin,
  validateRequest({ body: inviteInputSchema }),
  wrap(InviteController.create),
);
router.delete('/review-invites/:id', requireAdmin, byId, wrap(InviteController.remove));
router.get('/review-invites/:token', wrap(InviteController.lookup));

// Error tracking: reports from the site (quietly limited), list for the admin panel
const errorLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: false,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(204).end();
  },
});
router.post('/errors', errorLimiter, wrap(reportClientError));
router.get('/errors', requireAdmin, wrap(ErrorsController.list));
router.put('/errors/:id', requireAdmin, byId, wrap(ErrorsController.update));
router.delete('/errors/:id', requireAdmin, byId, wrap(ErrorsController.remove));

// Record server errors (5xx) from this module, then let the central handler answer
router.use(captureServerErrors);

startWeeklyReportScheduler();

export const portfolioRoutes = router;
