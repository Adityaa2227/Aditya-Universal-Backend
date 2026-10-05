import { Request } from 'express';

export interface AuthUser {
  userId: string;
  email: string;
  role?: string;
}

export interface ApiKeyPayload {
  keyId: string;
  name: string;
  project: string;
  permissions: string[];
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  apiKey?: ApiKeyPayload;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      apiKey?: ApiKeyPayload;
      id?: string;
    }
  }
}
