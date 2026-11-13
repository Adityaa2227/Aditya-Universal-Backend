// ============================================================================
// Portfolio Module - Site settings and admin account
// ----------------------------------------------------------------------------
// One settings document: the "open to work" badge shown on the homepage and
// whether contact-form senders get an automatic confirmation email.
// Also: changing the admin password from the admin panel.
// ============================================================================

import { Request, Response } from 'express';
import { Schema, Model } from 'mongoose';
import { z } from 'zod';
import { getPortfolioConnection } from './portfolio.db';
import { getModels, passwordMatches } from './portfolio.models';
import { sendSuccess } from '../../core/utils/response';
import { AppError } from '../../core/errors/AppError';
import type { AdminIdentity } from './portfolio.auth';

export interface ISettings {
  key: 'site';
  openToWork: {
    enabled: boolean;
    text: string; // e.g. "Open to SDE roles from June 2027"
    detail: string; // optional second line
  };
  contactAutoReply: boolean;
  updatedAt?: Date;
}

const settingsSchema = new Schema<ISettings>(
  {
    key: { type: String, default: 'site', unique: true },
    openToWork: {
      enabled: { type: Boolean, default: true },
      text: { type: String, default: 'Open to SDE roles' },
      detail: { type: String, default: '' },
    },
    contactAutoReply: { type: Boolean, default: true },
  },
  { timestamps: true },
);

let SettingsModel: Model<ISettings> | null = null;
const Settings = (): Model<ISettings> => {
  if (!SettingsModel)
    SettingsModel = getPortfolioConnection().model<ISettings>('Settings', settingsSchema);
  return SettingsModel;
};

const DEFAULTS: Omit<ISettings, 'key'> = {
  openToWork: { enabled: true, text: 'Open to SDE roles', detail: '' },
  contactAutoReply: true,
};

export const getSettings = async (): Promise<Omit<ISettings, 'key'>> => {
  const doc = await Settings().findOne({ key: 'site' }).lean();
  return doc
    ? {
        openToWork: { ...DEFAULTS.openToWork, ...doc.openToWork },
        contactAutoReply: doc.contactAutoReply ?? true,
        updatedAt: doc.updatedAt,
      }
    : DEFAULTS;
};

export const settingsInputSchema = z.object({
  openToWork: z
    .object({
      enabled: z.boolean(),
      text: z.string().trim().max(80),
      detail: z.string().trim().max(140).optional().default(''),
    })
    .optional(),
  contactAutoReply: z.boolean().optional(),
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z
      .string()
      .min(10, 'Use at least 10 characters')
      .max(200)
      .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), 'Use letters and at least one number'),
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: 'The new password must be different',
    path: ['newPassword'],
  });

export const SettingsController = {
  /** GET /settings - public (the site reads the open-to-work badge) */
  get: async (_req: Request, res: Response): Promise<void> => {
    const s = await getSettings();
    res.set('Cache-Control', 'public, max-age=60');
    sendSuccess(res, s);
  },

  /** PUT /settings (admin) */
  update: async (req: Request, res: Response): Promise<void> => {
    const input = req.body as z.infer<typeof settingsInputSchema>;
    const set: Record<string, unknown> = {};
    if (input.openToWork) set.openToWork = input.openToWork;
    if (input.contactAutoReply !== undefined) set.contactAutoReply = input.contactAutoReply;
    await Settings().updateOne(
      { key: 'site' },
      { $set: set, $setOnInsert: { key: 'site' } },
      { upsert: true },
    );
    sendSuccess(res, await getSettings(), 'Settings saved');
  },

  /** PUT /auth/password (admin) */
  changePassword: async (req: Request, res: Response): Promise<void> => {
    const { currentPassword, newPassword } = req.body as z.infer<typeof passwordChangeSchema>;
    const me = res.locals.admin as AdminIdentity;
    const admin = await getModels().Admin.findById(me._id);
    if (!admin || !(await passwordMatches(admin, currentPassword))) {
      throw AppError.badRequest('Your current password is wrong.');
    }
    admin.password = newPassword; // hashed by the model's pre-save hook
    await admin.save();
    sendSuccess(res, null, 'Password changed');
  },
};
