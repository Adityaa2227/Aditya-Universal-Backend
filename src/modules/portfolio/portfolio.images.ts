// ============================================================================
// Portfolio Module - AI cover images for blog posts
// ----------------------------------------------------------------------------
// Turns a post's title + summary into a cover image with Cloudflare Workers AI
// (FLUX.1 schnell, free daily allowance), uploads it to ImageKit and returns the
// URL. Nothing is saved to the post until the admin presses Save.
// Needs CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_AI_TOKEN.
// ============================================================================

import { Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import { AppError } from '../../core/errors/AppError';
import { sendSuccess } from '../../core/utils/response';
import { logger } from '../../core/utils/logger';
import { uploadToImageKit } from './portfolio.storage';

const MODEL = '@cf/black-forest-labs/flux-1-schnell';

export const coverInputSchema = z.object({
  title: z.string().trim().min(3, 'Add a title first').max(160),
  excerpt: z.string().trim().max(400).optional().default(''),
  content: z.string().max(200000).optional().default(''),
  style: z.string().trim().max(200).optional().default(''), // optional extra direction from the admin
});

/** Prompt in the portfolio's look; no text in the image (image models garble letters). */
export const buildCoverPrompt = (i: z.infer<typeof coverInputSchema>): string => {
  const about =
    i.excerpt ||
    i.content
      .replace(/[#*`>[\]()_-]/g, ' ')
      .replace(/\s+/g, ' ')
      .slice(0, 400);
  return [
    `Editorial cover illustration for a software engineering blog post titled "${i.title}".`,
    about ? `The post is about: ${about}` : '',
    'Visual metaphor for the topic using clean modern 3D / isometric shapes (servers, pipelines, code blocks, graphs, nodes) rather than people.',
    'Style: dark space-themed tech aesthetic, deep navy background (#070516), violet and magenta neon accents (#8B5CF6, #D946EF), soft glow, subtle stars, high detail, wide cinematic composition with the subject centred.',
    i.style ? `Extra direction: ${i.style}.` : '',
    'Absolutely no text, letters, numbers, words, logos or watermarks anywhere in the image.',
  ]
    .filter(Boolean)
    .join(' ');
};

const generateWithCloudflare = async (prompt: string): Promise<Buffer> => {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${MODEL}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.CLOUDFLARE_AI_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: prompt.slice(0, 2048), steps: 8 }),
      signal: AbortSignal.timeout(60000),
    },
  );
  const body = (await res.json().catch(() => ({}))) as {
    result?: { image?: string };
    errors?: { message?: string }[];
  };
  if (!res.ok || !body.result?.image) {
    const msg = body.errors?.[0]?.message || res.statusText || 'no image returned';
    throw new AppError(
      res.status === 429 || /neuron|limit|quota/i.test(msg)
        ? 'Today’s free Cloudflare image allowance is used up. Try again tomorrow.'
        : res.status === 401 || res.status === 403
          ? 'Cloudflare rejected the credentials. Check CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_AI_TOKEN (Workers AI permission).'
          : `Cloudflare couldn’t generate the image (${res.status}: ${msg}).`,
      502,
      'INTERNAL_SERVER_ERROR',
    );
  }
  return Buffer.from(body.result.image, 'base64');
};

/** POST /posts/ai-cover (admin) - { title, excerpt?, content?, style? } -> { url, provider } */
export const generateCover = async (req: Request, res: Response): Promise<void> => {
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_AI_TOKEN) {
    throw new AppError(
      'AI images aren’t set up. Add CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_AI_TOKEN on the server.',
      503,
      'SERVICE_UNAVAILABLE',
    );
  }
  const input = req.body as z.infer<typeof coverInputSchema>;
  const buffer = await generateWithCloudflare(buildCoverPrompt(input));
  const name = `cover-${input.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 40)}.jpg`;
  const url = await uploadToImageKit(
    { buffer, originalname: name, mimetype: 'image/jpeg' } as Express.Multer.File,
    '/portfolio/blog',
  );
  logger.info({ model: MODEL }, 'AI cover generated');
  // FLUX output is square; ImageKit crops it to the 1200x630 cover shape on delivery.
  sendSuccess(
    res,
    { url: `${url}?tr=w-1200,h-630,fo-auto`, provider: 'Cloudflare FLUX' },
    'Cover generated',
  );
};
