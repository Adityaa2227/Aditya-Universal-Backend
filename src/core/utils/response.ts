import { Response } from 'express';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode = 200,
): Response => {
  const responseBody: ApiResponse<T> = {
    success: true,
    data,
    message,
  };
  return res.status(statusCode).json(responseBody);
};

export const sendCreated = <T>(
  res: Response,
  data: T,
  message = 'Resource created successfully',
): Response => {
  return sendSuccess(res, data, message, 201);
};
