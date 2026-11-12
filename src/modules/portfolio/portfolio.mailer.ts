// ============================================================================
// Portfolio Module - Contact form email notification
// ============================================================================

import nodemailer from 'nodemailer';
import { env } from '../../config/env';
import { logger } from '../../core/utils/logger';

// Visitor input goes into an HTML email, so escape it.
const esc = (value: string): string =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

export interface ContactNotification {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}

/** Emails a new contact message to the portfolio owner. Returns false when email isn't configured or fails. */
export const sendContactNotification = async (msg: ContactNotification): Promise<boolean> => {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS || !env.PORTFOLIO_ADMIN_EMAIL) {
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

    await transporter.sendMail({
      from: env.SMTP_USER,
      replyTo: msg.email,
      to: env.PORTFOLIO_ADMIN_EMAIL,
      subject: `Portfolio Contact: ${msg.name}${msg.subject ? ` (${msg.subject})` : ''}`,
      text: `Name: ${msg.name}\nEmail: ${msg.email}\nPhone: ${msg.phone || '-'}\nSubject: ${msg.subject || '-'}\n\n${msg.message}`,
      html:
        `<p><strong>Name:</strong> ${esc(msg.name)}</p><p><strong>Email:</strong> ${esc(msg.email)}</p>` +
        `<p><strong>Phone:</strong> ${esc(msg.phone) || '-'}</p><p><strong>Subject:</strong> ${esc(msg.subject) || '-'}</p>` +
        `<p><strong>Message:</strong><br/>${esc(msg.message).replace(/\n/g, '<br/>')}</p>`,
    });
    return true;
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'Portfolio contact email failed');
    return false;
  }
};
