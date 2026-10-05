import { z } from 'zod';

export const createApiKeySchema = z.object({
  name: z
    .string({ required_error: 'API Key name is required' })
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters'),
  project: z
    .string({ required_error: 'Project name is required' })
    .trim()
    .min(2, 'Project must be at least 2 characters')
    .max(50, 'Project cannot exceed 50 characters')
    .regex(/^[a-z0-9-_]+$/, 'Project name must contain only lowercase letters, numbers, hyphens, and underscores'),
  permissions: z.array(z.string()).default(['*']),
});

export const apiKeyParamsSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid API Key ID format'),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
