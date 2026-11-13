// ============================================================================
// Portfolio Module - "Request a review" invite links
// ----------------------------------------------------------------------------
// The owner creates a personal link for a manager / client. Opening it shows the
// review form with their name and role filled in; the review is marked as invited
// and still waits for approval like every other review.
// ============================================================================

import crypto from 'crypto';
import { Request, Response } from 'express';
import { Schema, Model, Types, isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { getPortfolioConnection } from './portfolio.db';
import { sendSuccess, sendCreated } from '../../core/utils/response';
import { AppError } from '../../core/errors/AppError';

const SITE = 'https://adityaagarwalportfolio.vercel.app';

export interface IInvite {
  _id: Types.ObjectId;
  token: string;
  name: string;
  role: string;
  note: string; // private reminder for the owner, e.g. "PayPal manager"
  usedAt?: Date | null;
  reviewId?: Types.ObjectId | null;
  expiresAt: Date;
  createdAt: Date;
}

const inviteSchema = new Schema<IInvite>(
  {
    token: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, default: '', trim: true },
    note: { type: String, default: '' },
    usedAt: { type: Date, default: null },
    reviewId: { type: Schema.Types.ObjectId, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

let InviteModel: Model<IInvite> | null = null;
export const Invite = (): Model<IInvite> => {
  if (!InviteModel)
    InviteModel = getPortfolioConnection().model<IInvite>('ReviewInvite', inviteSchema);
  return InviteModel;
};

export const inviteInputSchema = z.object({
  name: z.string().trim().min(1, 'Who is the link for?').max(60),
  role: z.string().trim().max(80).optional().default(''),
  note: z.string().trim().max(200).optional().default(''),
  expiresInDays: z.coerce.number().int().min(1).max(365).optional().default(60),
});

const linkFor = (token: string) => `${SITE}/?review=${token}#reviews`;

const isUsable = (inv: Pick<IInvite, 'usedAt' | 'expiresAt'> | null): boolean =>
  Boolean(inv && !inv.usedAt && inv.expiresAt > new Date());

/** Called when a review is submitted with a token; returns the invite if valid. */
export const findUsableInvite = async (token?: string) => {
  if (!token || !/^[a-f0-9]{32}$/.test(token)) return null;
  const inv = await Invite().findOne({ token });
  return isUsable(inv) ? inv : null;
};

export const InviteController = {
  /** POST /review-invites (admin) */
  create: async (req: Request, res: Response): Promise<void> => {
    const { name, role, note, expiresInDays } = req.body as z.infer<typeof inviteInputSchema>;
    const token = crypto.randomBytes(16).toString('hex');
    const invite = await Invite().create({
      token,
      name,
      role,
      note,
      expiresAt: new Date(Date.now() + expiresInDays * 864e5),
    });
    sendCreated(res, { ...invite.toObject(), link: linkFor(token) }, 'Invite link created');
  },

  /** GET /review-invites (admin) */
  list: async (_req: Request, res: Response): Promise<void> => {
    const invites = await Invite().find({}).sort({ createdAt: -1 }).limit(200).lean();
    sendSuccess(
      res,
      invites.map((i) => ({
        ...i,
        link: linkFor(i.token),
        status: i.usedAt ? 'used' : i.expiresAt < new Date() ? 'expired' : 'open',
      })),
    );
  },

  /** DELETE /review-invites/:id (admin) */
  remove: async (req: Request, res: Response): Promise<void> => {
    if (!isValidObjectId(req.params.id)) throw AppError.badRequest('Invalid id');
    const deleted = await Invite().findByIdAndDelete(req.params.id).lean();
    if (!deleted) throw AppError.notFound('Invite not found');
    sendSuccess(res, { _id: req.params.id }, 'Invite deleted');
  },

  /** GET /review-invites/:token (public) - who the link is for, if it's still valid */
  lookup: async (req: Request, res: Response): Promise<void> => {
    const inv = await findUsableInvite(String(req.params.token));
    if (!inv) throw AppError.notFound('This review link has expired or was already used.');
    sendSuccess(res, { name: inv.name, role: inv.role });
  },
};
