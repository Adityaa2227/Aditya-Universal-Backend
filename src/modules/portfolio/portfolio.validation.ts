// ============================================================================
// Portfolio Module - Request validation (Zod)
// ============================================================================

import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Enter your username').max(100),
  password: z.string().min(1, 'Enter your password').max(200),
});

export const contactSchema = z.object({
  name: z.string().trim().min(1, 'Add your name').max(100),
  email: z.string().trim().email('Enter a valid email address').max(200),
  phone: z.string().trim().max(30).optional().default(''),
  subject: z.string().trim().max(120).optional().default(''),
  message: z.string().trim().min(1, 'Write a message').max(20000),
});

// Reviews: no length limit on the message (the 1 MB body limit still applies).
export const testimonialSchema = z.object({
  name: z.string().trim().min(1, 'Add your name').max(60),
  role: z.string().trim().min(1, 'Add your role or company').max(80),
  message: z.string().trim().min(1, 'Write your review'),
  rating: z.coerce.number().int().min(1).max(5).optional().default(5),
  website: z.string().optional(), // spam trap: only bots fill it
  inviteToken: z.string().trim().max(64).optional(), // from a "request a review" link
});

export const testimonialUpdateSchema = z
  .object({
    isApproved: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    message: z.string().trim().min(1, 'The review can’t be empty').optional(),
  })
  .refine(
    (v) => v.isApproved !== undefined || v.isFeatured !== undefined || v.message !== undefined,
    {
      message: 'Send isApproved, isFeatured or message',
    },
  );

export const reorderSchema = z.object({
  items: z
    .array(z.object({ _id: z.string().min(1), order: z.number().int().min(0) }))
    .min(1)
    .max(500),
});

export const idParamSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id'),
});

export const projectDraftSchema = z.object({
  notes: z
    .string()
    .trim()
    .min(20, 'Write a few sentences about the project first')
    .max(15000, 'Notes are too long (max 15,000 characters)'),
});

export const deleteManySchema = z.object({
  ids: z
    .array(z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id'))
    .min(1, 'Select at least one message')
    .max(500),
});
