// ============================================================================
// Portfolio Module - Weekly report email
// ----------------------------------------------------------------------------
// Every Monday ~9:00 IST the owner gets a summary of the last 7 days: visitors,
// sources, projects opened, resume downloads, chat questions, new messages and
// reviews. Runs in-process (the backend is always on); a timestamp in Settings
// makes sure it's sent once per week even with restarts or several instances.
// ============================================================================

import { Request, Response } from 'express';
import { computeSummary } from './portfolio.analytics';
import { getModels } from './portfolio.models';
import { isPortfolioConfigured } from './portfolio.db';
import { claimWeeklyReport, getSettings } from './portfolio.settings';
import { sendToOwner } from './portfolio.mailer';
import { sendSuccess } from '../../core/utils/response';
import { AppError } from '../../core/errors/AppError';
import { logger } from '../../core/utils/logger';

const SITE = 'https://adityaagarwalportfolio.vercel.app';
const esc = (v: unknown): string =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );

const change = (pct: number | null): string =>
  pct == null
    ? ''
    : ` <span style="color:${pct >= 0 ? '#059669' : '#dc2626'}">(${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct)}% vs previous week)</span>`;

const list = (
  title: string,
  rows: { name: string; count: number }[],
  fmt = (n: string) => n,
): string =>
  rows.length
    ? `<h3 style="margin:22px 0 6px;font-size:15px">${esc(title)}</h3><table style="border-collapse:collapse;width:100%;font-size:14px">${rows
        .slice(0, 5)
        .map(
          (r) =>
            `<tr><td style="padding:4px 0;border-bottom:1px solid #eee">${esc(fmt(String(r.name)))}</td><td style="padding:4px 0;border-bottom:1px solid #eee;text-align:right">${r.count}</td></tr>`,
        )
        .join('')}</table>`
    : '';

/** Builds the report for the last 7 days. */
export const buildWeeklyReport = async (): Promise<{
  subject: string;
  html: string;
  text: string;
}> => {
  const s = await computeSummary(7);
  const since = new Date(Date.now() - 7 * 864e5);
  const { ContactMessage, Testimonial } = getModels();
  const [messages, pendingReviews, newReviews] = await Promise.all([
    ContactMessage.find({ createdAt: { $gte: since } })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('name subject createdAt')
      .lean(),
    Testimonial.countDocuments({ isApproved: false }),
    Testimonial.countDocuments({ createdAt: { $gte: since } }),
  ]);
  const t = s.totals;

  const tiles = [
    ['Visitors', `${t.visitors}${change(t.change.visitors)}`],
    ['Page views', `${t.pageviews}${change(t.change.pageviews)}`],
    ['Resume downloads', t.resumeDownloads],
    ['Chat questions', t.chatQuestions],
    ['Contact messages', t.contacts],
    ['Avg. time on page', `${t.avgTimeOnPageSec}s`],
  ]
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 0;color:#555">${k}</td><td style="padding:6px 0;text-align:right;font-weight:600">${v}</td></tr>`,
    )
    .join('');

  const html = `<div style="font-family:Inter,Segoe UI,Arial,sans-serif;max-width:560px;margin:auto;color:#111">
  <h2 style="margin:0 0 4px">Your portfolio this week</h2>
  <p style="margin:0 0 16px;color:#666">${since.toDateString()} – ${new Date().toDateString()}</p>
  <table style="border-collapse:collapse;width:100%;font-size:15px">${tiles}</table>
  ${list('Where visitors came from', s.sources)}
  ${list('Projects opened', s.topProjects)}
  ${list('Countries', s.countries)}
  ${
    s.questions.length
      ? `<h3 style="margin:22px 0 6px;font-size:15px">What people asked the chat</h3><ul style="padding-left:18px;font-size:14px">${s.questions
          .slice(0, 6)
          .map((q) => `<li>${esc(q.question)}</li>`)
          .join('')}</ul>`
      : ''
  }
  ${messages.length ? `<h3 style="margin:22px 0 6px;font-size:15px">New messages (${messages.length})</h3><ul style="padding-left:18px;font-size:14px">${messages.map((m) => `<li>${esc(m.name)}${m.subject ? ` — ${esc(m.subject)}` : ''}</li>`).join('')}</ul>` : ''}
  <p style="margin:22px 0 0;font-size:14px">${newReviews} new review${newReviews === 1 ? '' : 's'} this week · <strong>${pendingReviews} waiting for approval</strong></p>
  <p style="margin:24px 0 0"><a href="${SITE}/admin/analytics" style="background:#7c3aed;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:600">Open full analytics</a></p>
  <p style="margin:18px 0 0;font-size:12px;color:#888">Turn this email off in Admin → Settings.</p>
</div>`;

  const text = [
    `Your portfolio this week (${since.toDateString()} – ${new Date().toDateString()})`,
    `Visitors: ${t.visitors} · Page views: ${t.pageviews} · Resume downloads: ${t.resumeDownloads} · Chat questions: ${t.chatQuestions} · Messages: ${t.contacts}`,
    `Top sources: ${
      s.sources
        .slice(0, 5)
        .map((r) => `${r.name} (${r.count})`)
        .join(', ') || '—'
    }`,
    `Projects opened: ${
      s.topProjects
        .slice(0, 5)
        .map((r) => `${r.name} (${r.count})`)
        .join(', ') || '—'
    }`,
    `Reviews waiting for approval: ${pendingReviews}`,
    `${SITE}/admin/analytics`,
  ].join('\n');

  return {
    subject: `Portfolio weekly: ${t.visitors} visitors, ${t.resumeDownloads} resume downloads`,
    html,
    text,
  };
};

/** POST /reports/weekly/test (admin) - sends this week's report now. */
export const sendWeeklyReportNow = async (_req: Request, res: Response): Promise<void> => {
  const report = await buildWeeklyReport();
  const sent = await sendToOwner(report, 'weekly report');
  if (!sent)
    throw new AppError(
      'The report couldn’t be emailed. Check BREVO_API_KEY and PORTFOLIO_ADMIN_EMAIL on the server.',
      502,
      'INTERNAL_SERVER_ERROR',
    );
  sendSuccess(res, { sent }, 'Report sent');
};

// ---------------------------------------------------------------------------
// Scheduler: checks every 15 minutes; sends on Monday from 09:00 IST, once.
// ---------------------------------------------------------------------------

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Start of the current week's send window (Monday 09:00 IST) as a UTC Date. */
export const currentWeekSlot = (now = new Date()): Date => {
  const ist = new Date(now.getTime() + IST_OFFSET_MS); // shift so UTC getters read IST
  const daysSinceMonday = (ist.getUTCDay() + 6) % 7;
  const monday9 = Date.UTC(
    ist.getUTCFullYear(),
    ist.getUTCMonth(),
    ist.getUTCDate() - daysSinceMonday,
    9,
    0,
    0,
  );
  return new Date(monday9 - IST_OFFSET_MS);
};

const tick = async (): Promise<void> => {
  if (!isPortfolioConfigured()) return;
  const slot = currentWeekSlot();
  if (Date.now() < slot.getTime()) return; // before Monday 09:00 IST this week
  const settings = await getSettings();
  if (!settings.weeklyReport) return;
  // Atomically claim this week's slot so only one process sends it.
  if (!(await claimWeeklyReport(slot))) return;
  const report = await buildWeeklyReport();
  const sent = await sendToOwner(report, 'weekly report');
  logger.info({ sent, slot }, 'Portfolio weekly report');
};

let timer: NodeJS.Timeout | null = null;
export const startWeeklyReportScheduler = (): void => {
  if (timer || process.env.NODE_ENV === 'test') return;
  const run = () =>
    tick().catch((err) => logger.error({ err: (err as Error).message }, 'Weekly report failed'));
  setTimeout(run, 60 * 1000).unref(); // first check a minute after boot
  timer = setInterval(run, 15 * 60 * 1000);
  timer.unref();
};
