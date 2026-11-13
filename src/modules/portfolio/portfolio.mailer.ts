// ============================================================================
// Portfolio Module - Email notifications to the owner (contact messages, new reviews)
// ============================================================================

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

/** Brevo transactional email API. */
const sendViaBrevo = async (mail: Mail, to: string, fromName = 'Portfolio'): Promise<void> => {
  // Sender must be verified in Brevo: BREVO_SENDER_EMAIL, else the owner's address.
  const sender = env.BREVO_SENDER_EMAIL || env.PORTFOLIO_ADMIN_EMAIL || to;
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': env.BREVO_API_KEY as string,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: fromName, email: sender },
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
 * Emails the portfolio owner through Brevo (the only email provider).
 * Returns false when Brevo isn't configured or the send fails; never throws,
 * so a mail problem never fails the visitor's request.
 */
export const sendToOwner = async (mail: Mail, kind: string): Promise<boolean> => {
  const to = env.PORTFOLIO_ADMIN_EMAIL;
  if (!to || !env.BREVO_API_KEY) {
    logger.warn(
      `Portfolio ${kind} email skipped: BREVO_API_KEY or PORTFOLIO_ADMIN_EMAIL is not set`,
    );
    return false;
  }
  try {
    await sendViaBrevo(mail, to);
    return true;
  } catch (err) {
    logger.error({ err: (err as Error).message }, `Portfolio ${kind} email via Brevo failed`);
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

/** Confirmation sent to someone who used the contact form (their reply goes to the owner). */
export const sendContactAutoReply = async (visitor: {
  name: string;
  email: string;
  subject: string;
}): Promise<boolean> => {
  if (!env.BREVO_API_KEY || !env.PORTFOLIO_ADMIN_EMAIL) return false;
  const first = visitor.name.split(/\s+/)[0] || 'there';
  const about = visitor.subject ? ` about “${visitor.subject}”` : '';
  try {
    await sendViaBrevo(
      {
        replyTo: env.PORTFOLIO_ADMIN_EMAIL,
        subject: 'Thanks for reaching out — Aditya Agarwal',
        text:
          `Hi ${first},\n\nThanks for your message${about}. I've received it and usually reply within 24 hours.\n\n` +
          `If it's urgent, just reply to this email.\n\nBest,\nAditya Agarwal\nhttps://adityaagarwalportfolio.vercel.app`,
        html:
          `<p>Hi ${esc(first)},</p><p>Thanks for your message${esc(about)}. I've received it and usually reply within 24 hours.</p>` +
          `<p>If it's urgent, just reply to this email.</p>` +
          `<p>Best,<br/>Aditya Agarwal<br/><a href="https://adityaagarwalportfolio.vercel.app">adityaagarwalportfolio.vercel.app</a></p>`,
      },
      visitor.email,
      'Aditya Agarwal',
    );
    return true;
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'Portfolio contact auto-reply via Brevo failed');
    return false;
  }
};
