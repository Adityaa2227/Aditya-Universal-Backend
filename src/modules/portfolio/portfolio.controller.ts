// ============================================================================
// Portfolio Module - Controller
// ----------------------------------------------------------------------------
// Backs adityaagarwalportfolio.vercel.app: projects, resume, reviews, contact
// messages and the admin login. Everything else on the site lives in code.
// ============================================================================

import { Request, Response, NextFunction } from 'express';
import { isValidObjectId } from 'mongoose';
import { sendSuccess, sendCreated } from '../../core/utils/response';
import { AppError } from '../../core/errors/AppError';
import { getModels, IProject, passwordMatches, toSlug } from './portfolio.models';
import { signAdminToken } from './portfolio.auth';
import { uploadToImageKit } from './portfolio.storage';
import { sendContactNotification } from './portfolio.mailer';
import { draftProjectFromNotes } from './portfolio.ai';

type Handler = (req: Request, res: Response) => Promise<unknown>;

/** Wraps an async handler so thrown errors reach the central error handler. */
const handle =
  (fn: Handler) =>
  (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };

// ---------------------------------------------------------------------------
// Project input parsing (JSON or multipart form fields)
// ---------------------------------------------------------------------------

const TEXT_FIELDS = [
  'title',
  'slug',
  'description',
  'shortDescription',
  'problem',
  'solution',
  'metrics',
  'category',
  'githubLink',
  'liveLink',
  'youtubeVideoUrl',
  'projectImage',
] as const;

// Values rendered as links or images must be web URLs (blocks javascript: and data: URLs).
const URL_FIELDS = new Set(['githubLink', 'liveLink', 'youtubeVideoUrl', 'projectImage']);

const toList = (value: unknown, separator: RegExp): string[] | undefined => {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === 'string')
    return value
      .split(separator)
      .map((v) => v.trim())
      .filter(Boolean);
  return undefined;
};

const toBool = (value: unknown): boolean | undefined =>
  value === undefined ? undefined : value === true || value === 'true';

const parseProjectInput = (body: Record<string, unknown>): Partial<IProject> => {
  const out: Record<string, unknown> = {};

  for (const key of TEXT_FIELDS) {
    if (body[key] === undefined || body[key] === null) continue;
    const value = String(body[key]).trim();
    if (value.length > 20000) throw AppError.badRequest(`${key} is too long`);
    if (URL_FIELDS.has(key) && value && !/^https?:\/\//i.test(value)) {
      throw AppError.badRequest(`${key} must start with http:// or https://`);
    }
    out[key] = value;
  }
  if (out.youtubeVideoUrl === '') out.youtubeVideoUrl = null;
  if (out.projectImage === '') out.projectImage = null;
  if (typeof out.slug === 'string') out.slug = toSlug(out.slug) || undefined;

  const technologies = toList(body.technologies, /,/);
  if (technologies) out.technologies = technologies;
  const tags = toList(body.tags, /,/);
  if (tags) out.tags = tags;
  const features = toList(body.features, /\r?\n/);
  if (features) out.features = features;

  const isFeatured = toBool(body.isFeatured);
  if (isFeatured !== undefined) out.isFeatured = isFeatured;
  const isPublished = toBool(body.isPublished);
  if (isPublished !== undefined) out.isPublished = isPublished;

  if (body.order !== undefined && Number.isFinite(Number(body.order)))
    out.order = Number(body.order);

  return out as Partial<IProject>;
};

const assertSlugFree = async (slug: string | undefined, exceptId?: string): Promise<void> => {
  if (!slug) return;
  const clash = await getModels()
    .Project.findOne({ slug, ...(exceptId ? { _id: { $ne: exceptId } } : {}) })
    .select('_id')
    .lean();
  if (clash) throw AppError.conflict(`Another project already uses the URL "/projects/${slug}".`);
};

export class PortfolioController {
  // ----------------------------------------------------------------------------
  // Auth
  // ----------------------------------------------------------------------------

  /** POST /auth/login */
  static login = handle(async (req, res) => {
    const { username, password } = req.body as { username: string; password: string };
    const admin = await getModels().Admin.findOne({ username }).lean();
    if (!admin || !(await passwordMatches(admin, password))) {
      throw AppError.unauthorized('Wrong username or password.');
    }
    sendSuccess(
      res,
      {
        _id: String(admin._id),
        username: admin.username,
        token: signAdminToken(String(admin._id)),
      },
      'Logged in',
    );
  });

  /** GET /auth/me (admin) */
  static me = handle(async (_req, res) => {
    sendSuccess(res, res.locals.admin);
  });

  // ----------------------------------------------------------------------------
  // Projects
  // ----------------------------------------------------------------------------

  /** GET /projects - published projects in display order */
  static listProjects = handle(async (_req, res) => {
    const projects = await getModels()
      .Project.find({ isPublished: true })
      .sort({ order: 1, createdAt: -1 })
      .lean();
    sendSuccess(res, projects);
  });

  /** GET /projects/admin (admin) - every project, including drafts */
  static listAllProjects = handle(async (_req, res) => {
    const projects = await getModels().Project.find({}).sort({ order: 1, createdAt: -1 }).lean();
    sendSuccess(res, projects);
  });

  /** GET /projects/:idOrSlug - a published project by id or URL slug */
  static getProject = handle(async (req, res) => {
    const { idOrSlug } = req.params;
    const { Project } = getModels();
    const slug = idOrSlug.toLowerCase();
    let project = isValidObjectId(idOrSlug)
      ? await Project.findOne({ _id: idOrSlug, isPublished: true }).lean()
      : await Project.findOne({ slug, isPublished: true }).lean();
    if (!project) {
      // Older records have no stored slug: match the slug the site derives from the title.
      const candidates = await Project.find({
        isPublished: true,
        $or: [{ slug: { $exists: false } }, { slug: null }, { slug: '' }],
      }).lean();
      project = candidates.find((p) => toSlug(p.title) === slug) ?? null;
    }
    if (!project) throw AppError.notFound('Project not found');
    sendSuccess(res, project);
  });

  /** POST /projects (admin, multipart with optional "image") */
  static createProject = handle(async (req, res) => {
    const input = parseProjectInput(req.body as Record<string, unknown>);
    if (!input.title) throw AppError.badRequest('Add a title');
    if (!input.description) throw AppError.badRequest('Add an overview (description)');
    input.slug = input.slug || toSlug(input.title);
    await assertSlugFree(input.slug);

    if (req.file) input.projectImage = await uploadToImageKit(req.file, '/portfolio/projects');

    const project = await getModels().Project.create({
      category: 'Full Stack',
      shortDescription: input.description.slice(0, 160),
      ...input,
    });
    sendCreated(res, project, 'Project created');
  });

  /** PUT /projects/:id (admin, JSON or multipart with optional "image") */
  static updateProject = handle(async (req, res) => {
    const { id } = req.params;
    const project = await getModels().Project.findById(id);
    if (!project) throw AppError.notFound('Project not found');

    const input = parseProjectInput(req.body as Record<string, unknown>);
    if (input.title === '') throw AppError.badRequest('The title can’t be empty');
    if (input.description === '') throw AppError.badRequest('The overview can’t be empty');
    if (input.slug !== undefined) await assertSlugFree(input.slug, id);

    if (req.file) input.projectImage = await uploadToImageKit(req.file, '/portfolio/projects');

    project.set(input);
    await project.save();
    sendSuccess(res, project, 'Project updated');
  });

  /** POST /projects/ai-draft (admin) - body { notes } -> AI-filled project fields (nothing is saved) */
  static draftProject = handle(async (req, res) => {
    const { notes } = req.body as { notes: string };
    const { draft, provider, model } = await draftProjectFromNotes(notes);
    sendSuccess(res, { ...draft, generatedBy: `${provider}/${model}` }, 'Draft generated');
  });

  /** PUT /projects/reorder (admin) - body { items: [{ _id, order }] } */
  static reorderProjects = handle(async (req, res) => {
    const { items } = req.body as { items: { _id: string; order: number }[] };
    const valid = items.filter((item) => isValidObjectId(item._id));
    await getModels().Project.bulkWrite(
      valid.map((item) => ({
        updateOne: { filter: { _id: item._id }, update: { $set: { order: item.order } } },
      })),
    );
    sendSuccess(res, { updated: valid.length }, 'Projects reordered');
  });

  /** DELETE /projects/:id (admin) */
  static deleteProject = handle(async (req, res) => {
    const deleted = await getModels().Project.findByIdAndDelete(req.params.id).lean();
    if (!deleted) throw AppError.notFound('Project not found');
    sendSuccess(res, { _id: req.params.id }, 'Project deleted');
  });

  // ----------------------------------------------------------------------------
  // Resume
  // ----------------------------------------------------------------------------

  /** GET /resume - the active resume, or the PDF bundled with the site */
  static getActiveResume = handle(async (_req, res) => {
    const resume = await getModels().Resume.findOne({ isActive: true }).lean();
    sendSuccess(
      res,
      resume ?? { fileName: 'Aditya_Agarwal_Resume.pdf', fileUrl: '/resume.pdf', isActive: true },
    );
  });

  /** GET /resume/all (admin) - upload history */
  static listResumes = handle(async (_req, res) => {
    const resumes = await getModels().Resume.find({}).sort({ createdAt: -1 }).lean();
    sendSuccess(res, resumes);
  });

  /** POST /resume (admin, multipart "resume" PDF) - uploads and makes it active */
  static uploadResume = handle(async (req, res) => {
    if (!req.file) throw AppError.badRequest('Choose a PDF file to upload.');
    const fileUrl = await uploadToImageKit(req.file, '/portfolio/resume');
    const { Resume } = getModels();
    await Resume.updateMany({ isActive: true }, { $set: { isActive: false } });
    const resume = await Resume.create({
      fileUrl,
      fileName: req.file.originalname,
      isActive: true,
    });
    sendCreated(res, resume, 'Resume uploaded');
  });

  /** PUT /resume/:id/active (admin) */
  static activateResume = handle(async (req, res) => {
    const { Resume } = getModels();
    const resume = await Resume.findById(req.params.id);
    if (!resume) throw AppError.notFound('Resume not found');
    await Resume.updateMany({ _id: { $ne: resume._id } }, { $set: { isActive: false } });
    resume.isActive = true;
    await resume.save();
    sendSuccess(res, resume, 'Active resume changed');
  });

  // ----------------------------------------------------------------------------
  // Reviews (testimonials)
  // ----------------------------------------------------------------------------

  /** GET /testimonials - approved reviews only */
  static listApprovedTestimonials = handle(async (_req, res) => {
    const reviews = await getModels()
      .Testimonial.find({ isApproved: true })
      .select('name role message rating isApproved isFeatured createdAt')
      .sort({ createdAt: -1 })
      .lean();
    sendSuccess(res, reviews);
  });

  /** POST /testimonials - public submission, always saved unapproved */
  static submitTestimonial = handle(async (req, res) => {
    const { name, role, message, rating, website } = req.body as {
      name: string;
      role: string;
      message: string;
      rating: number;
      website?: string;
    };
    // Spam trap: pretend success so bots don't retry.
    if (website) {
      sendCreated(res, null, 'Review received');
      return;
    }
    await getModels().Testimonial.create({
      name,
      role,
      message,
      rating,
      isApproved: false,
      isFeatured: false,
    });
    sendCreated(res, null, 'Review received. It will appear once approved.');
  });

  /** GET /testimonials/admin (admin) */
  static listAllTestimonials = handle(async (_req, res) => {
    const reviews = await getModels().Testimonial.find({}).sort({ createdAt: -1 }).lean();
    sendSuccess(res, reviews);
  });

  /** PUT /testimonials/:id (admin) - { isApproved?, isFeatured? } */
  static updateTestimonial = handle(async (req, res) => {
    const { isApproved, isFeatured } = req.body as { isApproved?: boolean; isFeatured?: boolean };
    const update: Record<string, boolean> = {};
    if (isApproved !== undefined) update.isApproved = isApproved;
    if (isFeatured !== undefined) update.isFeatured = isFeatured;
    const review = await getModels()
      .Testimonial.findByIdAndUpdate(req.params.id, { $set: update }, { new: true })
      .lean();
    if (!review) throw AppError.notFound('Review not found');
    sendSuccess(res, review, 'Review updated');
  });

  /** DELETE /testimonials/:id (admin) */
  static deleteTestimonial = handle(async (req, res) => {
    const deleted = await getModels().Testimonial.findByIdAndDelete(req.params.id).lean();
    if (!deleted) throw AppError.notFound('Review not found');
    sendSuccess(res, { _id: req.params.id }, 'Review deleted');
  });

  // ----------------------------------------------------------------------------
  // Contact messages
  // ----------------------------------------------------------------------------

  /** POST /contact - saves the message and emails it to the owner */
  static submitContact = handle(async (req, res) => {
    const msg = req.body as {
      name: string;
      email: string;
      phone: string;
      subject: string;
      message: string;
    };
    const saved = await getModels().ContactMessage.create(msg);
    const emailed = await sendContactNotification(msg);
    sendCreated(res, { _id: String(saved._id), emailed }, 'Message sent');
  });

  /** GET /contact (admin) - inbox, newest first */
  static listMessages = handle(async (_req, res) => {
    const messages = await getModels().ContactMessage.find({}).sort({ createdAt: -1 }).lean();
    sendSuccess(res, messages);
  });

  /** DELETE /contact (admin) - body { ids: [...] } deletes the selected messages */
  static deleteMessages = handle(async (req, res) => {
    const { ids } = req.body as { ids: string[] };
    const result = await getModels().ContactMessage.deleteMany({ _id: { $in: ids } });
    sendSuccess(res, { deleted: result.deletedCount }, `Deleted ${result.deletedCount} message(s)`);
  });

  /** GET /sitemap.xml - live sitemap for the portfolio site (served at its /sitemap.xml via a Vercel rewrite) */
  static sitemap = handle(async (_req, res) => {
    const site = 'https://adityaagarwalportfolio.vercel.app';
    const projects = await getModels()
      .Project.find({ isPublished: true })
      .select('slug title updatedAt')
      .sort({ order: 1 })
      .lean<{ slug?: string; title: string; updatedAt?: Date }[]>();
    const day = (d?: Date) => (d ? new Date(d) : new Date()).toISOString().slice(0, 10);
    const latest = projects.reduce<Date | undefined>(
      (acc, p) => (p.updatedAt && (!acc || p.updatedAt > acc) ? p.updatedAt : acc),
      undefined,
    );
    const urls = [
      { loc: '/', lastmod: day(latest), priority: '1.0' },
      { loc: '/projects', lastmod: day(latest), priority: '0.8' },
      ...projects
        .map((p) => ({ slug: p.slug || toSlug(p.title), updatedAt: p.updatedAt }))
        .filter((p) => p.slug)
        .map((p) => ({
          loc: `/projects/${encodeURIComponent(p.slug)}`,
          lastmod: day(p.updatedAt),
          priority: '0.6',
        })),
    ];
    const entries = urls.map(
      (u) =>
        `  <url><loc>${site}${u.loc}</loc><lastmod>${u.lastmod}</lastmod><priority>${u.priority}</priority></url>`,
    );
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...entries,
      '</urlset>',
      '',
    ].join('\n');
    res.set('Cache-Control', 'public, max-age=3600').type('application/xml').send(xml);
  });
}
