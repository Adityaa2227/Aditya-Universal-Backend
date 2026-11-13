// ============================================================================
// Portfolio Module - Error tracking and alerts
// ----------------------------------------------------------------------------
// Errors from visitors' browsers (sent by the site) and server errors (5xx) in
// this module are grouped by fingerprint, counted, listed in the admin panel and
// emailed to the owner: once when first seen, then at most once a day per error.
// ============================================================================

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { Schema, Model, Types, isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { getPortfolioConnection } from './portfolio.db';
import { getSettings } from './portfolio.settings';
import { sendToOwner } from './portfolio.mailer';
import { parseUserAgent } from './portfolio.analytics';
import { sendSuccess } from '../../core/utils/response';
import { AppError } from '../../core/errors/AppError';

export interface IErrorLog {
  _id: Types.ObjectId;
  fingerprint: string;
  source: 'site' | 'api';
  message: string;
  stack: string;
  path: string; // page path (site) or API route (api)
  count: number;
  browsers: string[];
  firstSeen: Date;
  lastSeen: Date;
  lastAlertAt?: Date | null;
  resolved: boolean;
}

const errorSchema = new Schema<IErrorLog>(
  {
    fingerprint: { type: String, required: true, unique: true, index: true },
    source: { type: String, enum: ['site', 'api'], required: true },
    message: { type: String, required: true },
    stack: { type: String, default: '' },
    path: { type: String, default: '' },
    count: { type: Number, default: 1 },
    browsers: [{ type: String }],
    firstSeen: { type: Date, default: Date.now },
    lastSeen: { type: Date, default: Date.now },
    lastAlertAt: { type: Date, default: null },
    resolved: { type: Boolean, default: false },
  },
  { versionKey: false },
);

let ErrorModel: Model<IErrorLog> | null = null;
const ErrorLog = (): Model<IErrorLog> => {
  if (!ErrorModel) ErrorModel = getPortfolioConnection().model<IErrorLog>('ErrorLog', errorSchema);
  return ErrorModel;
};

const DAY = 24 * 60 * 60 * 1000;
const esc = (v: string) =>
  v.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );

/** First stack frame with line numbers stripped, so the same bug groups together across builds. */
const fingerprintOf = (source: string, message: string, stack: string): string => {
  const frame = (stack.split('\n').find((l) => /at |@/.test(l)) || '')
    .replace(/:\d+(:\d+)?/g, '')
    .replace(/[a-f0-9]{8,}/gi, '');
  const msg = message.replace(/\d+/g, 'N').slice(0, 200);
  return crypto.createHash('sha1').update(`${source}|${msg}|${frame.trim()}`).digest('hex');
};

export const recordError = async (e: {
  source: 'site' | 'api';
  message: string;
  stack?: string;
  path?: string;
  browser?: string;
}): Promise<void> => {
  try {
    const message = e.message.slice(0, 500) || 'Unknown error';
    const stack = (e.stack || '').slice(0, 4000);
    const fingerprint = fingerprintOf(e.source, message, stack);
    const now = new Date();
    const doc = await ErrorLog().findOneAndUpdate(
      { fingerprint },
      {
        $setOnInsert: { fingerprint, source: e.source, message, stack, firstSeen: now },
        $set: { lastSeen: now, path: (e.path || '').slice(0, 300), resolved: false },
        $inc: { count: 1 },
        ...(e.browser ? { $addToSet: { browsers: e.browser } } : {}),
      },
      { upsert: true, new: true },
    );
    if (!doc) return;

    // Alert: first time, or again after a day (also when a "resolved" error comes back).
    const settings = await getSettings();
    if (!settings.errorAlerts) return;
    if (doc.lastAlertAt && now.getTime() - doc.lastAlertAt.getTime() < DAY) return;
    const claimed = await ErrorLog().updateOne(
      {
        _id: doc._id,
        $or: [{ lastAlertAt: null }, { lastAlertAt: { $lt: new Date(now.getTime() - DAY) } }],
      },
      { $set: { lastAlertAt: now } },
    );
    if (!claimed.modifiedCount) return;
    const where = e.source === 'site' ? 'in a visitor’s browser' : 'in the API';
    await sendToOwner(
      {
        subject: `Portfolio error ${where}: ${message.slice(0, 80)}`,
        text: `${message}\n\nWhere: ${where} (${doc.path || '-'})\nSeen ${doc.count} time(s), first ${doc.firstSeen.toISOString()}\n\n${stack.slice(0, 1500)}\n\nhttps://adityaagarwalportfolio.vercel.app/admin/errors`,
        html:
          `<p><strong>${esc(message)}</strong></p><p>Where: ${where} <code>${esc(doc.path || '-')}</code><br/>Seen ${doc.count} time(s) · first ${doc.firstSeen.toUTCString()}</p>` +
          `<pre style="background:#f4f4f5;padding:10px;border-radius:8px;font-size:12px;white-space:pre-wrap">${esc(stack.slice(0, 1500))}</pre>` +
          `<p><a href="https://adityaagarwalportfolio.vercel.app/admin/errors">See all errors in the admin panel</a> · You get at most one email per error per day.</p>`,
      },
      'error alert',
    );
  } catch {
    /* error tracking must never cause errors */
  }
};

export const clientErrorSchema = z.object({
  message: z.string().trim().min(1).max(1000),
  stack: z.string().max(8000).optional().default(''),
  path: z.string().max(300).optional().default(''),
});

/** POST /errors - from the site; answers 204 and never fails. */
export const reportClientError = async (req: Request, res: Response): Promise<void> => {
  res.status(204).end();
  const parsed = clientErrorSchema.safeParse(req.body);
  if (!parsed.success) return;
  const ua = parseUserAgent(String(req.headers['user-agent'] || ''));
  if (ua.device === 'bot') return;
  // Noise from browser extensions and blocked third-party scripts isn't the site's fault.
  if (
    /ResizeObserver loop|chrome-extension:|moz-extension:|Script error\.?$/i.test(
      `${parsed.data.message} ${parsed.data.stack}`,
    )
  )
    return;
  await recordError({ source: 'site', ...parsed.data, browser: `${ua.browser} / ${ua.os}` });
};

/** Error middleware for the portfolio router: records 5xx, then passes the error on. */
export const captureServerErrors = (
  err: unknown,
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const status =
    err instanceof AppError ? err.statusCode : ((err as { status?: number })?.status ?? 500);
  if (status >= 500) {
    const e = err as Error;
    void recordError({
      source: 'api',
      message: e?.message || String(err),
      stack: e?.stack,
      path: `${req.method} ${req.baseUrl}${req.path}`,
    });
  }
  next(err);
};

export const ErrorsController = {
  /** GET /errors (admin) */
  list: async (_req: Request, res: Response): Promise<void> => {
    const errors = await ErrorLog().find({}).sort({ resolved: 1, lastSeen: -1 }).limit(200).lean();
    sendSuccess(res, errors);
  },
  /** PUT /errors/:id (admin) - { resolved } */
  update: async (req: Request, res: Response): Promise<void> => {
    if (!isValidObjectId(req.params.id)) throw AppError.badRequest('Invalid id');
    const resolved = Boolean((req.body as { resolved?: boolean }).resolved);
    const doc = await ErrorLog()
      .findByIdAndUpdate(req.params.id, { $set: { resolved } }, { new: true })
      .lean();
    if (!doc) throw AppError.notFound('Error not found');
    sendSuccess(res, doc, resolved ? 'Marked as resolved' : 'Reopened');
  },
  /** DELETE /errors/:id (admin) */
  remove: async (req: Request, res: Response): Promise<void> => {
    if (!isValidObjectId(req.params.id)) throw AppError.badRequest('Invalid id');
    await ErrorLog().findByIdAndDelete(req.params.id);
    sendSuccess(res, { _id: req.params.id }, 'Deleted');
  },
};
