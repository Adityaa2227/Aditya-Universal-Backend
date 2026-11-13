// ============================================================================
// Portfolio Module - Admin auth (JWT)
// ============================================================================

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { AppError } from '../../core/errors/AppError';
import { getModels } from './portfolio.models';

export interface AdminIdentity {
  _id: string;
  username: string;
}

export const signAdminToken = (id: string): string =>
  jwt.sign({ id }, env.PORTFOLIO_JWT_SECRET as string, { expiresIn: '30d' });

/** Requires "Authorization: Bearer <token>". The admin is stored on res.locals.admin. */
export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw AppError.unauthorized('Log in to the admin panel to do this.');
    }

    let payload: jwt.JwtPayload | string;
    try {
      payload = jwt.verify(header.slice(7), env.PORTFOLIO_JWT_SECRET as string);
    } catch {
      throw AppError.unauthorized('Your session expired. Log in again.');
    }

    const id = typeof payload === 'object' ? payload.id : undefined;
    const admin = id ? await getModels().Admin.findById(id).select('username').lean() : null;
    if (!admin) {
      throw AppError.unauthorized('Your session expired. Log in again.');
    }

    res.locals.admin = { _id: String(admin._id), username: admin.username } satisfies AdminIdentity;
    next();
  } catch (err) {
    next(err);
  }
};
