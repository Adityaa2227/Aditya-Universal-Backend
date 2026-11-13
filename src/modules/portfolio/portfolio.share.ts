// ============================================================================
// Portfolio Module - Link previews for social apps
// ----------------------------------------------------------------------------
// LinkedIn, WhatsApp, X, Slack, Telegram, Discord... don't run JavaScript, so
// they can't see the per-page titles the site sets in the browser. Vercel sends
// only those preview bots here (see client/vercel.json); this returns a tiny HTML
// page with the right Open Graph tags for the project / blog post. People never
// see it, and Google gets the normal site.
// ============================================================================

import { Request, Response } from 'express';
import { getModels, toSlug } from './portfolio.models';
import { Post } from './portfolio.blog';

const SITE = 'https://adityaagarwalportfolio.vercel.app';
const DEFAULT_IMAGE = `${SITE}/og-image.jpg`;
const DEFAULT_DESC =
  'Aditya Agarwal, Software Engineer (backend, full-stack and GenAI). Ex-SWE Intern at PayPal, B.Tech CSE at BIT Mesra.';

const esc = (v: string): string =>
  v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

const clip = (v: string, max: number): string => {
  const s = v.replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
};

/** 1200x630 version of an image: ImageKit crops on the fly; other hosts are used as they are. */
const previewImage = (url?: string | null): string => {
  if (!url || !/^https:\/\//i.test(url)) return DEFAULT_IMAGE;
  if (url.includes('tr=')) return url; // already sized (e.g. AI blog covers)
  if (url.includes('ik.imagekit.io')) {
    const base = url.split('?')[0];
    return `${base}?tr=w-1200,h-630,fo-top`;
  }
  return url;
};

const page = (p: { title: string; description: string; image: string; path: string; type: string }): string => {
  const url = `${SITE}${p.path}`;
  const t = esc(p.title);
  const d = esc(p.description);
  const img = esc(p.image);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${t}</title>
<meta name="description" content="${d}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="${p.type}">
<meta property="og:site_name" content="Aditya Agarwal">
<meta property="og:url" content="${esc(url)}">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:image" content="${img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${img}">
<meta http-equiv="refresh" content="0; url=${esc(url)}">
</head><body><a href="${esc(url)}">${t}</a></body></html>`;
};

const send = (res: Response, html: string, status = 200): void => {
  res.status(status).set('Cache-Control', 'public, max-age=600').type('html').send(html);
};

/** GET /share/projects/:slug */
export const shareProject = async (req: Request, res: Response): Promise<void> => {
  const slug = String(req.params.slug || '').toLowerCase().slice(0, 120);
  const { Project } = getModels();
  let p = await Project.findOne({ slug, isPublished: true }).lean();
  if (!p) {
    const candidates = await Project.find({ isPublished: true, $or: [{ slug: { $exists: false } }, { slug: null }, { slug: '' }] }).lean();
    p = candidates.find((c) => toSlug(c.title) === slug) ?? null;
  }
  if (!p) {
    send(res, page({ title: 'Projects | Aditya Agarwal', description: DEFAULT_DESC, image: DEFAULT_IMAGE, path: '/projects', type: 'website' }), 404);
    return;
  }
  const tech = (p.technologies || []).slice(0, 5).join(' · ');
  send(
    res,
    page({
      title: `${p.title} | Aditya Agarwal`,
      description: clip(`${p.shortDescription || p.description || ''}${tech ? ` Built with ${tech}.` : ''}`, 200) || DEFAULT_DESC,
      image: previewImage(p.projectImage),
      path: `/projects/${encodeURIComponent(slug)}`,
      type: 'article',
    }),
  );
};

/** GET /share/blog/:slug */
export const sharePost = async (req: Request, res: Response): Promise<void> => {
  const slug = String(req.params.slug || '').toLowerCase().slice(0, 120);
  const post = await Post().findOne({ slug, isPublished: true }).lean();
  if (!post) {
    send(res, page({ title: 'Blog | Aditya Agarwal', description: DEFAULT_DESC, image: DEFAULT_IMAGE, path: '/blog', type: 'website' }), 404);
    return;
  }
  send(
    res,
    page({
      title: `${post.title} | Aditya Agarwal`,
      description: clip(post.excerpt || post.content.replace(/[#*`>[\]()_-]/g, ' '), 200) || DEFAULT_DESC,
      image: previewImage(post.coverImage),
      path: `/blog/${encodeURIComponent(slug)}`,
      type: 'article',
    }),
  );
};
