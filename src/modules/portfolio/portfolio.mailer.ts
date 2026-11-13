// ============================================================================
// Portfolio Module - Email notifications to the owner (contact messages, new reviews)
// ============================================================================

import nodemailer from 'nodemailer';
import { env } from '../../config/env';
import { logger } from '../../core/utils/logger';

const ADMIN_URL = 'https://adityaagarwalportfolio.vercel.app/admin';

// Visitor input goes into an HTML email, so escape it.
const esc = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );

interface Mail {
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}

/** Brevo transactional API (HTTPS, so it works where hosts block SMTP ports). */
const sendViaBrevo = async (mail: Mail, to: string): Promise<void> => {
  const sender = env.BREVO_SENDER_EMAIL || to;
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': env.BREVO_API_KEY as string,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'Portfolio', email: sender },
      to: [{ email: to }],
      subject: mail.subject,
      htmlContent: mail.html,
      textContent: mail.text,
      ...(mail.replyTo ? { replyTo: { email: mail.replyTo } } : {}),
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(`Brevo ${res.status}: ${body.message || res.statusText}`);
  }
};

/**
 * Sends a mail to the portfolio owner via Brevo (if BREVO_API_KEY is set) or SMTP.
 * Returns false when email isn't configured or sending fails; never throws.
 */
export const sendToOwner = async (mail: Mail, kind: string): Promise<boolean> => {
  const to = env.PORTFOLIO_ADMIN_EMAIL;
  if (!to) return false;

  if (env.BREVO_API_KEY) {
    try {
      await sendViaBrevo(mail, to);
      return true;
    } catch (err) {
      logger.error({ err: (err as Error).message }, `Portfolio ${kind} email via Brevo failed`);
      if (!env.SMTP_HOST) return false; // fall through to SMTP when it's configured
    }
  }

  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    return false;
  }
  const port = env.SMTP_PORT ?? 465;
  try {
    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
    });
    await transporter.sendMail({ from: env.SMTP_USER, to: env.PORTFOLIO_ADMIN_EMAIL, ...mail });
    return true;
  } catch (err) {
    logger.error({ err: (err as Error).message }, `Portfolio ${kind} email failed`);
    return false;
  }
};

export interface ContactNotification {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}

export const sendContactNotification = (msg: ContactNotification): Promise<boolean> =>
  sendToOwner(
    {
      replyTo: msg.email,
      subject: `Portfolio Contact: ${msg.name}${msg.subject ? ` (${msg.subject})` : ''}`,
      text: `Name: ${msg.name}\nEmail: ${msg.email}\nPhone: ${msg.phone || '-'}\nSubject: ${msg.subject || '-'}\n\n${msg.message}`,
      html:
        `<p><strong>Name:</strong> ${esc(msg.name)}</p><p><strong>Email:</strong> ${esc(msg.email)}</p>` +
        `<p><strong>Phone:</strong> ${esc(msg.phone) || '-'}</p><p><strong>Subject:</strong> ${esc(msg.subject) || '-'}</p>` +
        `<p><strong>Message:</strong><br/>${esc(msg.message).replace(/\n/g, '<br/>')}</p>`,
    },
    'contact',
  );

export interface ReviewNotification {
  name: string;
  role: string;
  message: string;
  rating: number;
}

export const sendReviewNotification = (review: ReviewNotification): Promise<boolean> => {
  const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
  return sendToOwner(
    {
      subject: `New review waiting for approval: ${review.name} (${review.rating}/5)`,
      text:
        `${review.name}, ${review.role}\n${stars}\n\n${review.message}\n\n` +
        `It stays hidden until you approve it: ${ADMIN_URL}/reviews`,
      html:
        `<p><strong>${esc(review.name)}</strong>, ${esc(review.role)}<br/><span style="color:#f59e0b">${stars}</span></p>` +
        `<blockquote style="border-left:3px solid #8b5cf6;margin:0;padding:4px 12px">${esc(review.message).replace(/\n/g, '<br/>')}</blockquote>` +
        `<p>It stays hidden until you approve it. <a href="${ADMIN_URL}/reviews">Review it in the admin panel</a>.</p>`,
    },
    'review',
  );
};
