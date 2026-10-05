// ============================================================================
// Form Filler Module - Routes
// ============================================================================

import { Router } from 'express';
import { FormFillerController } from './form-filler.controller';

const router = Router();

// GET  /api/v1/form-filler/health     - Service + AI provider health
router.get('/health', FormFillerController.health);

// GET  /api/v1/form-filler/providers  - List active AI providers  
router.get('/providers', FormFillerController.getProviders);

// POST /api/v1/form-filler/fill       - Batch fill all form fields
router.post('/fill', FormFillerController.fillFields);

// POST /api/v1/form-filler/ai-answer  - Answer a single field with AI
router.post('/ai-answer', FormFillerController.answerSingleField);

export const formFillerRoutes = router;
