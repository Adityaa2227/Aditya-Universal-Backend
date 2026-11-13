// ============================================================================
// Portfolio Module - Blog / notes
// ----------------------------------------------------------------------------
// Posts are written in Markdown in the admin panel (optionally drafted by AI
// from rough notes) and shown at /blog on the site.
// ============================================================================

import { Request, Response } from 'express';
import { Schema, Model, Types, isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { getPortfolioConnection } from './portfolio.db';
import { toSlug } from './portfolio.models';
import { sendSuccess, sendCreated } from '../../core/utils/response';
import { AppError } from '../../core/errors/AppError';
import { executeFormFillerFallbackText } from '../form-filler/form-filler.ai';

export interface IPost {
  _id: Types.ObjectId;
  title: string;
  slug: string;
  excerpt: string;
  content: string; // Markdown
  coverImage?: string | null;
  tags: string[];
  isPublished: boolean;
  publishedAt?: Date | null;
  readingMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}

const postSchema = new Schema<IPost>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },
    excerpt: { type: String, default: '' },
    content: { type: String, default: '' },
    coverImage: { type: String, default: null },
    tags: [{ type: String }],
    isPublished: { type: Boolean, default: false },
    publishedAt: { type: Date, default: null },
    readingMinutes: { type: Number, default: 1 },
  },
  { timestamps: true },
);

let PostModel: Model<IPost> | null = null;
export const Post = (): Model<IPost> => {
  if (!PostModel) PostModel = getPortfolioConnection().model<IPost>('Post', postSchema);
  return PostModel;
};

const minutesToRead = (markdown: string): number =>
  Math.max(1, Math.round(markdown.split(/\s+/).filter(Boolean).length / 220));

export const postInputSchema = z.object({
  title: z.string().trim().min(1, 'Add a title').max(160),
  slug: z.string().trim().max(120).optional(),
  excerpt: z.string().trim().max(400).optional().default(''),
  content: z.string().max(200000).optional().default(''),
  coverImage: z
    .string()
    .trim()
    .max(1000)
    .refine((v) => !v || /^https?:\/\//i.test(v), 'Cover image must be an http(s) URL')
    .optional()
    .nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional().default([]),
  isPublished: z.boolean().optional().default(false),
});

export const postDraftSchema = z.object({
  notes: z.string().trim().min(20, 'Write a few sentences first').max(20000),
});

const publicFields = 'title slug excerpt coverImage tags publishedAt readingMinutes';

const assertSlugFree = async (slug: string, exceptId?: string): Promise<void> => {
  const clash = await Post()
    .findOne({ slug, ...(exceptId ? { _id: { $ne: exceptId } } : {}) })
    .select('_id')
    .lean();
  if (clash) throw AppError.conflict(`Another post already uses the URL "/blog/${slug}".`);
};

export const BlogController = {
  /** GET /posts - published posts, newest first (no content) */
  list: async (_req: Request, res: Response): Promise<void> => {
    const posts = await Post()
      .find({ isPublished: true })
      .select(publicFields)
      .sort({ publishedAt: -1 })
      .lean();
    sendSuccess(res, posts);
  },

  /** GET /posts/:slug - one published post with its content */
  get: async (req: Request, res: Response): Promise<void> => {
    const post = await Post()
      .findOne({ slug: String(req.params.slug).toLowerCase(), isPublished: true })
      .lean();
    if (!post) throw AppError.notFound('Post not found');
    sendSuccess(res, post);
  },

  /** GET /posts/admin (admin) - all posts incl. drafts */
  listAll: async (_req: Request, res: Response): Promise<void> => {
    const posts = await Post().find({}).sort({ updatedAt: -1 }).lean();
    sendSuccess(res, posts);
  },

  /** POST /posts (admin) */
  create: async (req: Request, res: Response): Promise<void> => {
    const input = req.body as z.infer<typeof postInputSchema>;
    const slug = toSlug(input.slug || input.title);
    if (!slug) throw AppError.badRequest('Add a title with letters or numbers');
    await assertSlugFree(slug);
    const post = await Post().create({
      ...input,
      slug,
      readingMinutes: minutesToRead(input.content),
      publishedAt: input.isPublished ? new Date() : null,
    });
    sendCreated(res, post, 'Post created');
  },

  /** PUT /posts/:id (admin) */
  update: async (req: Request, res: Response): Promise<void> => {
    if (!isValidObjectId(req.params.id)) throw AppError.badRequest('Invalid id');
    const post = await Post().findById(req.params.id);
    if (!post) throw AppError.notFound('Post not found');
    const input = req.body as z.infer<typeof postInputSchema>;
    const slug = toSlug(input.slug || input.title);
    if (slug !== post.slug) await assertSlugFree(slug, String(post._id));
    const firstPublish = input.isPublished && !post.isPublished && !post.publishedAt;
    post.set({
      ...input,
      slug,
      readingMinutes: minutesToRead(input.content),
      ...(firstPublish ? { publishedAt: new Date() } : {}),
    });
    await post.save();
    sendSuccess(res, post, 'Post saved');
  },

  /** DELETE /posts/:id (admin) */
  remove: async (req: Request, res: Response): Promise<void> => {
    if (!isValidObjectId(req.params.id)) throw AppError.badRequest('Invalid id');
    const deleted = await Post().findByIdAndDelete(req.params.id).lean();
    if (!deleted) throw AppError.notFound('Post not found');
    sendSuccess(res, { _id: req.params.id }, 'Post deleted');
  },

  /** POST /posts/ai-draft (admin) - { notes } -> { title, excerpt, content, tags } (nothing is saved) */
  aiDraft: async (req: Request, res: Response): Promise<void> => {
    const { notes } = req.body as { notes: string };
    const result = await executeFormFillerFallbackText({
      systemPrompt: BLOG_PROMPT,
      userPrompt: `Rough notes:\n"""\n${notes}\n"""`,
      temperature: 0.5,
      maxTokens: 3500,
    });
    const start = result.text.indexOf('{');
    const end = result.text.lastIndexOf('}');
    let draft: z.infer<typeof draftOut>;
    try {
      draft = draftOut.parse(JSON.parse(result.text.slice(start, end + 1)));
    } catch {
      throw new AppError('The AI reply couldn’t be read. Try again.', 502, 'INTERNAL_SERVER_ERROR');
    }
    if (!draft.content)
      throw new AppError(
        'The AI returned an empty post. Add more detail and try again.',
        502,
        'INTERNAL_SERVER_ERROR',
      );
    sendSuccess(
      res,
      { ...draft, generatedBy: `${result.provider}/${result.model}` },
      'Draft generated',
    );
  },
};

const BLOG_PROMPT = `You help Aditya Agarwal, a software engineer (backend, full-stack, GenAI; ex-SWE intern at PayPal), turn rough notes into a technical blog post for his portfolio.

Rules:
- Use only ideas and facts from the notes. You may explain and structure them, add short code snippets that illustrate what the notes describe, and connect the dots, but never invent results, numbers, companies or experiences.
- First person, clear and practical. No hype words. Short paragraphs, "##" section headings, bullet lists where useful, fenced code blocks with a language tag.
- Length: 600-1200 words unless the notes are very short.
- Reply with ONE JSON object and nothing else (no markdown fences around it):
{"title": "specific, max 80 chars", "excerpt": "1-2 sentences, max 200 chars", "content": "the full post in Markdown, without repeating the title as a heading", "tags": ["3-6 short lowercase tags"]}`;

const draftOut = z.object({
  title: z.coerce.string().trim().max(160).catch(''),
  excerpt: z.coerce.string().trim().max(400).catch(''),
  content: z.coerce.string().catch(''),
  tags: z
    .array(z.coerce.string().trim().toLowerCase())
    .transform((t) => t.filter(Boolean).slice(0, 8))
    .catch([]),
});
