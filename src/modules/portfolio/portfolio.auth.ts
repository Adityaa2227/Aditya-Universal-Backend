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

const ALGORITHM = 'HS256' as const;

/**
 * `pv` = when the password was last changed (ms). Tokens issued before a password
 * change stop working, so changing the password logs out every other session.
 */
export const signAdminToken = (id: string, passwordChangedAt?: Date | null): string =>
  jwt.sign({ id, pv: passwordChangedAt ? passwordChangedAt.getTime() : 0 }, env.PORTFOLIO_JWT_SECRET as string, {
    algorithm: ALGORITHM,
    expiresIn: '30d',
  });

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
      payload = jwt.verify(header.slice(7), env.PORTFOLIO_JWT_SECRET as string, {
        algorithms: [ALGORITHM],
      });
    } catch {
      throw AppError.unauthorized('Your session expired. Log in again.');
    }

    const id = typeof payload === 'object' ? payload.id : undefined;
    if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) {
      throw AppError.unauthorized('Your session expired. Log in again.');
    }
    const admin = await getModels().Admin.findById(id).select('username passwordChangedAt').lean();
    const issuedForPassword = typeof payload === 'object' ? Number(payload.pv) || 0 : 0;
    const currentPassword = admin?.passwordChangedAt ? new Date(admin.passwordChangedAt).getTime() : 0;
    if (!admin || issuedForPassword < currentPassword) {
      throw AppError.unauthorized('Your session expired. Log in again.');
    }

    res.locals.admin = { _id: String(admin._id), username: admin.username } satisfies AdminIdentity;
    next();
  } catch (err) {
    next(err);
  }
};
