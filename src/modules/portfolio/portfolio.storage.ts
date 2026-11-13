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

/**
 * Checks a file's real signature (first bytes), since the type a browser reports can be faked.
 * Blocks e.g. HTML/SVG/scripts renamed to .png or sent with an image/pdf content type.
 */
export const contentMatches = (buf: Buffer, kind: 'image' | 'pdf'): boolean => {
  if (!buf || buf.length < 12) return false;
  if (kind === 'pdf') return buf.subarray(0, 5).toString('latin1') === '%PDF-';
  const hex = buf.subarray(0, 12).toString('hex');
  return (
    hex.startsWith('ffd8ff') || // JPEG
    hex.startsWith('89504e470d0a1a0a') || // PNG
    buf.subarray(0, 6).toString('latin1').startsWith('GIF8') || // GIF
    (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') ||
    buf.subarray(4, 12).toString('latin1').startsWith('ftypavi') // AVIF
  );
};

/** Runs a multer single-file upload and turns its errors (e.g. file too large) into 400s. */
export const singleFile = (upload: multer.Multer, field: string) => {
  // Cast: without a lockfile (Render's yarn install) multer and swagger-ui-express can resolve
  // different copies of the Express type definitions; at runtime it's the same Express.
  const handler = upload.single(field) as unknown as RequestHandler;
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res, (err: unknown) => {
      if (!err) {
        if (req.file && !contentMatches(req.file.buffer, upload === pdfUpload ? 'pdf' : 'image')) {
          return next(
            AppError.badRequest(
              upload === pdfUpload ? 'That file isn’t a valid PDF.' : 'That file isn’t a valid JPG, PNG, GIF, WebP or AVIF image.',
            ),
          );
        }
        return next();
      }
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
