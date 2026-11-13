// ============================================================================
// Portfolio Module - Uploads (multer in memory -> ImageKit)
// ----------------------------------------------------------------------------
// Files go straight to ImageKit: Render's disk is wiped on every restart.
// ============================================================================

import { Request, RequestHandler, Response, NextFunction } from 'express';
import multer from 'multer';
import ImageKit from 'imagekit';
import { env } from '../../config/env';
import { AppError } from '../../core/errors/AppError';

const IMAGE_TYPES = /^image\/(jpeg|png|gif|webp|avif)$/;

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (IMAGE_TYPES.test(file.mimetype)) return cb(null, true);
    return cb(AppError.badRequest('Upload a JPG, PNG, GIF, WebP or AVIF image.'));
  },
});

export const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') return cb(null, true);
    return cb(AppError.badRequest('The resume must be a PDF.'));
  },
});

/** Runs a multer single-file upload and turns its errors (e.g. file too large) into 400s. */
export const singleFile = (upload: multer.Multer, field: string) => {
  // Cast: without a lockfile (Render's yarn install) multer and swagger-ui-express can resolve
  // different copies of the Express type definitions; at runtime it's the same Express.
  const handler = upload.single(field) as unknown as RequestHandler;
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res, (err: unknown) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        const message =
          err.code === 'LIMIT_FILE_SIZE'
            ? 'That file is too large.'
            : `Upload failed: ${err.message}`;
        return next(AppError.badRequest(message));
      }
      return next(err);
    });
  };
};

let imagekit: ImageKit | null = null;

export const uploadToImageKit = async (
  file: Express.Multer.File,
  folder: string,
): Promise<string> => {
  if (!env.IMAGEKIT_PUBLIC_KEY || !env.IMAGEKIT_PRIVATE_KEY || !env.IMAGEKIT_URL_ENDPOINT) {
    throw new AppError(
      'File uploads are not configured on the server (IMAGEKIT_* settings are missing).',
      503,
      'SERVICE_UNAVAILABLE',
    );
  }
  if (!imagekit) {
    imagekit = new ImageKit({
      publicKey: env.IMAGEKIT_PUBLIC_KEY,
      privateKey: env.IMAGEKIT_PRIVATE_KEY,
      urlEndpoint: env.IMAGEKIT_URL_ENDPOINT,
    });
  }
  const uploaded = await imagekit.upload({
    file: file.buffer,
    fileName: file.originalname.replace(/[^\w.-]+/g, '_'),
    folder,
    useUniqueFileName: true,
  });
  return uploaded.url;
};
