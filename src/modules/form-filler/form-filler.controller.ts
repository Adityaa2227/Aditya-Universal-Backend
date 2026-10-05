// ============================================================================
// Form Filler Module - Controller
// ============================================================================

import { Request, Response, NextFunction } from 'express';
import { batchFillFields } from './form-filler.service';
import { getFormFillerProviderChain } from './form-filler.ai';
import { sendSuccess } from '../../core/utils/response';
import { AppError } from '../../core/errors/AppError';
import { BatchFillRequest } from './form-filler.types';

export class FormFillerController {

  /**
   * POST /api/v1/form-filler/fill
   * Batch fill form fields using profile data + AI fallback.
   */
  static async fillFields(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.body as BatchFillRequest;

      if (!body.fields || !Array.isArray(body.fields) || body.fields.length === 0) {
        throw AppError.badRequest('fields array is required and must not be empty', 'BAD_REQUEST');
      }

      if (body.fields.length > 100) {
        throw AppError.badRequest('Maximum 100 fields per request', 'BAD_REQUEST');
      }

      const result = await batchFillFields(body);
      sendSuccess(res, result, `Filled ${result.stats.fromProfile} from profile, ${result.stats.fromAI} via AI`);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/form-filler/providers
   * Returns list of active AI providers (for extension status display).
   */
  static async getProviders(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const chain = getFormFillerProviderChain();
      sendSuccess(res, {
        providers: chain.map((p) => ({ name: p.name, models: p.models })),
        total: chain.length,
      }, 'Active AI provider chain');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/form-filler/ai-answer
   * Answer a single form field question using AI.
   */
  static async answerSingleField(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { field, jobContext, profile } = req.body as BatchFillRequest & { field: unknown };

      if (!field) {
        throw AppError.badRequest('field object is required', 'BAD_REQUEST');
      }

      const result = await batchFillFields({
        fields: [field as BatchFillRequest['fields'][0]],
        jobContext,
        profile,
      });

      if (result.results.length === 0) {
        throw AppError.internal('AI returned no result');
      }

      sendSuccess(res, result.results[0], 'Field answered');
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/form-filler/health
   * Quick health check showing provider status.
   */
  static async health(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const chain = getFormFillerProviderChain();
      res.status(chain.length > 0 ? 200 : 503).json({
        success: chain.length > 0,
        service: 'form-filler',
        activeProviders: chain.length,
        providers: chain.map((p) => p.name),
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  }
}
