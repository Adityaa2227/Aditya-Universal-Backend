// ============================================================================
// Portfolio Module - Visitor analytics
// ----------------------------------------------------------------------------
// First-party and cookie-free: the site sends small events (page views, project
// views, resume downloads, outbound clicks, section views, time on page...).
// No IP address is stored. A random visitor id lives in the visitor's browser
// storage, so unique visitors can be counted without identifying anyone.
// Events are kept for 13 months (TTL index), then deleted automatically.
// ============================================================================

import { Request } from 'express';
import { Schema, Model, PipelineStage } from 'mongoose';
import { z } from 'zod';
import { getPortfolioConnection } from './portfolio.db';
import { sendSuccess } from '../../core/utils/response';

export const EVENT_TYPES = [
  'pageview', // any page opened
  'project_view', // a project detail page
  'post_view', // a blog post
  'resume_download', // resume opened or downloaded
  'outbound', // click to GitHub, LinkedIn, live demo, email...
  'section_view', // homepage section scrolled into view (about, projects...)
  'contact_submit',
  'review_submit',
  'engagement', // time on page + scroll depth, sent when leaving a page
  'chat_question', // question asked in the "Ask my portfolio" chat (label = the question)
] as const;

export interface IEvent {
  type: (typeof EVENT_TYPES)[number];
  path: string;
  target?: string; // project slug, post slug, link url, section id...
  label?: string;
  visitorId: string;
  sessionId: string;
  isNewVisitor: boolean;
  referrer?: string; // host only
  source: string; // grouped: google, linkedin, direct...
  utm?: { source?: string; medium?: string; campaign?: string };
  device: 'mobile' | 'tablet' | 'desktop' | 'bot';
  browser: string;
  os: string;
  country?: string; // from the visitor's timezone/language, approximate
  timezone?: string;
  language?: string;
  screen?: string;
  durationSec?: number;
  scrollPct?: number;
  createdAt: Date;
}

const eventSchema = new Schema<IEvent>(
  {
    type: { type: String, enum: EVENT_TYPES, required: true, index: true },
    path: { type: String, required: true },
    target: String,
    label: String,
    visitorId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true },
    isNewVisitor: { type: Boolean, default: false },
    referrer: String,
    source: { type: String, default: 'direct' },
    utm: { source: String, medium: String, campaign: String },
    device: { type: String, default: 'desktop' },
    browser: { type: String, default: 'Other' },
    os: { type: String, default: 'Other' },
    country: String,
    timezone: String,
    language: String,
    screen: String,
    durationSec: Number,
    scrollPct: Number,
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
eventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 400 });
eventSchema.index({ type: 1, createdAt: -1 });

let EventModel: Model<IEvent> | null = null;
const Event = (): Model<IEvent> => {
  if (!EventModel)
    EventModel = getPortfolioConnection().model<IEvent>('AnalyticsEvent', eventSchema);
  return EventModel;
};

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

const BOT =
  /bot|crawler|spider|crawling|headless|lighthouse|preview|facebookexternalhit|slurp|bingpreview|whatsapp|telegram|discord|slack/i;

export const parseUserAgent = (ua: string): Pick<IEvent, 'device' | 'browser' | 'os'> => {
  const device: IEvent['device'] = BOT.test(ua)
    ? 'bot'
    : /ipad|tablet/i.test(ua)
      ? 'tablet'
      : /mobi|android|iphone/i.test(ua)
        ? 'mobile'
        : 'desktop';
  const browser = /edg\//i.test(ua)
    ? 'Edge'
    : /opr\/|opera/i.test(ua)
      ? 'Opera'
      : /samsungbrowser/i.test(ua)
        ? 'Samsung Internet'
        : /chrome|crios/i.test(ua)
          ? 'Chrome'
          : /firefox|fxios/i.test(ua)
            ? 'Firefox'
            : /safari/i.test(ua)
              ? 'Safari'
              : 'Other';
  const os = /windows/i.test(ua)
    ? 'Windows'
    : /iphone|ipad|ios/i.test(ua)
      ? 'iOS'
      : /mac os/i.test(ua)
        ? 'macOS'
        : /android/i.test(ua)
          ? 'Android'
          : /linux/i.test(ua)
            ? 'Linux'
            : 'Other';
  return { device, browser, os };
};

/** Groups a referrer host into a readable traffic source. */
export const sourceOf = (host: string | undefined, utmSource?: string): string => {
  if (utmSource) return utmSource.toLowerCase().slice(0, 40);
  if (!host) return 'direct';
  const h = host.toLowerCase();
  const known: [RegExp, string][] = [
    [/linkedin|lnkd\.in/, 'linkedin'],
    [/google\./, 'google'],
    [/bing\./, 'bing'],
    [/duckduckgo/, 'duckduckgo'],
    [/github/, 'github'],
    [/twitter|x\.com|t\.co$/, 'x / twitter'],
    [/facebook|fb\./, 'facebook'],
    [/instagram/, 'instagram'],
    [/whatsapp|wa\.me/, 'whatsapp'],
    [/t\.me|telegram/, 'telegram'],
    [/reddit/, 'reddit'],
    [/youtube|youtu\.be/, 'youtube'],
    [/mail\.|outlook|gmail/, 'email'],
    [/naukri|indeed|wellfound|glassdoor|instahyre/, 'job sites'],
  ];
  return known.find(([re]) => re.test(h))?.[1] ?? h.replace(/^www\./, '');
};

// Timezone -> country, for the common cases (no IP lookups).
const TZ_COUNTRY: Record<string, string> = {
  'Asia/Kolkata': 'India',
  'Asia/Calcutta': 'India',
  'America/New_York': 'United States',
  'America/Chicago': 'United States',
  'America/Denver': 'United States',
  'America/Los_Angeles': 'United States',
  'America/Phoenix': 'United States',
  'America/Toronto': 'Canada',
  'America/Vancouver': 'Canada',
  'Europe/London': 'United Kingdom',
  'Europe/Dublin': 'Ireland',
  'Europe/Berlin': 'Germany',
  'Europe/Paris': 'France',
  'Europe/Amsterdam': 'Netherlands',
  'Europe/Madrid': 'Spain',
  'Europe/Rome': 'Italy',
  'Europe/Zurich': 'Switzerland',
  'Europe/Stockholm': 'Sweden',
  'Europe/Warsaw': 'Poland',
  'Asia/Singapore': 'Singapore',
  'Asia/Dubai': 'UAE',
  'Asia/Tokyo': 'Japan',
  'Asia/Seoul': 'South Korea',
  'Asia/Shanghai': 'China',
  'Asia/Hong_Kong': 'Hong Kong',
  'Asia/Dhaka': 'Bangladesh',
  'Asia/Kathmandu': 'Nepal',
  'Asia/Karachi': 'Pakistan',
  'Asia/Jakarta': 'Indonesia',
  'Australia/Sydney': 'Australia',
  'Australia/Melbourne': 'Australia',
  'Africa/Lagos': 'Nigeria',
  'Africa/Nairobi': 'Kenya',
  'America/Sao_Paulo': 'Brazil',
  'America/Mexico_City': 'Mexico',
};
export const countryOf = (timezone?: string): string | undefined =>
  timezone ? (TZ_COUNTRY[timezone] ?? timezone.split('/')[0]) : undefined;

const short = (max: number) => z.string().trim().max(max).optional();

export const eventInputSchema = z.object({
  type: z.enum(EVENT_TYPES),
  path: z.string().trim().min(1).max(300),
  target: short(300),
  label: short(120),
  visitorId: z.string().trim().min(8).max(64),
  sessionId: z.string().trim().min(8).max(64),
  isNewVisitor: z.boolean().optional(),
  referrer: short(500),
  utm: z.object({ source: short(60), medium: short(60), campaign: short(80) }).optional(),
  timezone: short(60),
  language: short(20),
  screen: short(20),
  durationSec: z
    .number()
    .min(0)
    .max(60 * 60 * 6)
    .optional(),
  scrollPct: z.number().min(0).max(100).optional(),
});

type EventInput = z.infer<typeof eventInputSchema>;

const hostOf = (url?: string): string | undefined => {
  if (!url) return undefined;
  try {
    const host = new URL(url).hostname;
    return host.endsWith('adityaagarwalportfolio.vercel.app') || host === 'localhost'
      ? undefined
      : host;
  } catch {
    return undefined;
  }
};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/** POST /analytics/event - public, fire-and-forget from the site. Answers 204 and never errors to the visitor. */
export const recordEvent = async (req: Request, res: import('express').Response): Promise<void> => {
  res.status(204).end();
  try {
    const parsed = eventInputSchema.safeParse(req.body);
    if (!parsed.success) return;
    const e: EventInput = parsed.data;
    const ua = parseUserAgent(String(req.headers['user-agent'] || ''));
    if (ua.device === 'bot') return; // don't count crawlers and link-preview bots
    const referrer = hostOf(e.referrer);
    await Event().create({
      ...e,
      ...ua,
      referrer,
      source: sourceOf(referrer, e.utm?.source),
      country: countryOf(e.timezone),
      isNewVisitor: Boolean(e.isNewVisitor),
    });
  } catch {
    /* analytics must never affect the site */
  }
};

const top = (field: string, match: Record<string, unknown>, limit = 10): PipelineStage[] => [
  { $match: match },
  { $group: { _id: `$${field}`, count: { $sum: 1 }, visitors: { $addToSet: '$visitorId' } } },
  {
    $project: {
      _id: 0,
      name: { $ifNull: ['$_id', '(unknown)'] },
      count: 1,
      visitors: { $size: '$visitors' },
    },
  },
  { $sort: { count: -1 as const } },
  { $limit: limit },
];

/** GET /analytics/summary?days=30 (admin) - everything the dashboard shows, in one call. */
/** Everything the dashboard (and the weekly email) shows, for the last `daysInput` days. */
export const computeSummary = async (daysInput: number) => {
  const days = Math.min(400, Math.max(1, Math.round(daysInput) || 30));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const prevSince = new Date(since.getTime() - days * 24 * 60 * 60 * 1000);
  const E = Event();
  const inRange = { createdAt: { $gte: since } };
  const views = { ...inRange, type: 'pageview' };
  const tz = 'Asia/Kolkata';

  const count = async (match: Record<string, unknown>) => E.countDocuments(match);
  const distinct = async (field: string, match: Record<string, unknown>) =>
    (await E.distinct(field, match)).length;

  const [
    pageviews,
    visitors,
    sessions,
    newVisitors,
    prevPageviews,
    prevVisitors,
    resumeDownloads,
    contacts,
    reviews,
    outboundClicks,
    chatQuestions,
    daily,
    topPages,
    topProjects,
    topPosts,
    sources,
    referrers,
    devices,
    browsers,
    oses,
    countries,
    sections,
    outbound,
    engagement,
    recent,
    hours,
    questions,
  ] = await Promise.all([
    count(views),
    distinct('visitorId', views),
    distinct('sessionId', views),
    distinct('visitorId', { ...views, isNewVisitor: true }),
    count({ type: 'pageview', createdAt: { $gte: prevSince, $lt: since } }),
    distinct('visitorId', { type: 'pageview', createdAt: { $gte: prevSince, $lt: since } }),
    count({ ...inRange, type: 'resume_download' }),
    count({ ...inRange, type: 'contact_submit' }),
    count({ ...inRange, type: 'review_submit' }),
    count({ ...inRange, type: 'outbound' }),
    count({ ...inRange, type: 'chat_question' }),
    E.aggregate([
      { $match: views },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: tz } },
          views: { $sum: 1 },
          visitors: { $addToSet: '$visitorId' },
        },
      },
      { $project: { _id: 0, date: '$_id', views: 1, visitors: { $size: '$visitors' } } },
      { $sort: { date: 1 } },
    ]),
    E.aggregate(top('path', views)),
    E.aggregate(top('target', { ...inRange, type: 'project_view' })),
    E.aggregate(top('target', { ...inRange, type: 'post_view' })),
    E.aggregate(top('source', views)),
    E.aggregate(top('referrer', { ...views, referrer: { $exists: true, $ne: null } })),
    E.aggregate(top('device', views, 5)),
    E.aggregate(top('browser', views, 6)),
    E.aggregate(top('os', views, 6)),
    E.aggregate(top('country', views, 12)),
    E.aggregate(top('target', { ...inRange, type: 'section_view' }, 12)),
    E.aggregate(top('label', { ...inRange, type: 'outbound' }, 12)),
    E.aggregate([
      { $match: { ...inRange, type: 'engagement' } },
      {
        $group: {
          _id: null,
          avgDuration: { $avg: '$durationSec' },
          avgScroll: { $avg: '$scrollPct' },
          n: { $sum: 1 },
        },
      },
    ]),
    E.find({ ...inRange, type: { $ne: 'engagement' } })
      .sort({ createdAt: -1 })
      .limit(40)
      .select(
        'type path target label source device browser os country createdAt visitorId isNewVisitor',
      )
      .lean(),
    E.aggregate([
      { $match: views },
      { $group: { _id: { $hour: { date: '$createdAt', timezone: tz } }, count: { $sum: 1 } } },
      { $project: { _id: 0, hour: '$_id', count: 1 } },
      { $sort: { hour: 1 } },
    ]),
    E.find({ ...inRange, type: 'chat_question' })
      .sort({ createdAt: -1 })
      .limit(30)
      .select('label country device createdAt')
      .lean(),
  ]);

  // Sessions that saw only one page
  const bounce = await E.aggregate([
    { $match: views },
    { $group: { _id: '$sessionId', pages: { $sum: 1 } } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        single: { $sum: { $cond: [{ $eq: ['$pages', 1] }, 1, 0] } },
      },
    },
  ]);

  const eng = engagement[0] as { avgDuration?: number; avgScroll?: number } | undefined;
  const b = bounce[0] as { total: number; single: number } | undefined;

  return {
    range: { days, since },
    totals: {
      pageviews,
      visitors,
      sessions,
      newVisitors,
      returningVisitors: Math.max(0, visitors - newVisitors),
      pagesPerSession: sessions ? +(pageviews / sessions).toFixed(1) : 0,
      bounceRate: b?.total ? Math.round((b.single / b.total) * 100) : 0,
      avgTimeOnPageSec: Math.round(eng?.avgDuration ?? 0),
      avgScrollPct: Math.round(eng?.avgScroll ?? 0),
      resumeDownloads,
      contacts,
      reviews,
      outboundClicks,
      chatQuestions,
      change: {
        pageviews: prevPageviews
          ? Math.round(((pageviews - prevPageviews) / prevPageviews) * 100)
          : null,
        visitors: prevVisitors
          ? Math.round(((visitors - prevVisitors) / prevVisitors) * 100)
          : null,
      },
    },
    daily,
    hours,
    topPages,
    topProjects,
    topPosts,
    sources,
    referrers,
    devices,
    browsers,
    oses,
    countries,
    sections,
    outbound,
    recent,
    questions: questions.map((q) => ({
      question: q.label,
      country: q.country,
      device: q.device,
      at: q.createdAt,
    })),
  };
};

/** GET /analytics/summary?days=30 (admin) */
export const analyticsSummary = async (
  req: Request,
  res: import('express').Response,
): Promise<void> => {
  sendSuccess(res, await computeSummary(Number(req.query.days) || 30));
};

/** Records a chat question (called by the chat endpoint; never throws). */
export const logChatQuestion = async (q: {
  question: string;
  visitorId?: string;
  sessionId?: string;
  userAgent: string;
}): Promise<void> => {
  try {
    const ua = parseUserAgent(q.userAgent);
    if (ua.device === 'bot') return;
    await Event().create({
      type: 'chat_question',
      path: '/chat',
      label: q.question.slice(0, 300),
      visitorId: q.visitorId || 'unknown-visitor',
      sessionId: q.sessionId || 'unknown-session',
      source: 'direct',
      ...ua,
    });
  } catch {
    /* analytics must never affect the chat */
  }
};

/** Read-only access for the weekly report. */
export const getEventModel = () => Event();
