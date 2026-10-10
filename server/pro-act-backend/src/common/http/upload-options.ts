import {
  ForbiddenException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { RequestWithContext } from '../context/request-context.middleware';

/** Plan 3.11 (NFR02 request limits): one attachment per request, 25 MiB at most. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** Root of stored attachments: `<cwd>/uploads/<tenantId>/<uuid>.<ext>`. */
export const UPLOAD_ROOT = join(process.cwd(), 'uploads');

/**
 * Evidence and attachment types (photos, documents, spreadsheets, time-series exports, videos). Anything
 * a browser would execute or render as a page (html, svg, js, ...) is refused with 415.
 */
export const ALLOWED_UPLOAD_EXTENSIONS: ReadonlySet<string> = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.bmp',
  '.tif',
  '.tiff',
  '.pdf',
  '.txt',
  '.csv',
  '.json',
  '.xml',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.odt',
  '.ods',
  '.mp4',
  '.webm',
  '.mov',
  '.zip',
]);

export function isAllowedUpload(originalName: string): boolean {
  return ALLOWED_UPLOAD_EXTENSIONS.has(extname(originalName).toLowerCase());
}

function tenantOf(request: unknown): string | null {
  return (request as RequestWithContext).requestContext?.tenantId ?? null;
}

/**
 * Multer options shared by every upload route: size / count limits, type allowlist, random names, and a
 * tenant folder (the acting tenant; 403 `TENANT_REQUIRED` without one). Files are never served
 * statically: `GET /api/uploads/files/:tenantId/:name` streams them to members of that tenant.
 */
export function attachmentUploadOptions(): MulterOptions {
  return {
    storage: diskStorage({
      destination: (req, _file, cb) => {
        const tenantId = tenantOf(req);
        if (!tenantId) {
          cb(
            new ForbiddenException({
              code: 'TENANT_REQUIRED',
              message: 'Uploads belong to a tenant',
            }),
            '',
          );
          return;
        }
        const folder = join(UPLOAD_ROOT, tenantId.toLowerCase());
        mkdirSync(folder, { recursive: true });
        cb(null, folder);
      },
      filename: (_req, file, cb) => {
        cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
      },
    }),
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 20 },
    fileFilter: (_req, file, cb) => {
      if (isAllowedUpload(file.originalname)) {
        cb(null, true);
        return;
      }
      cb(
        new UnsupportedMediaTypeException({
          code: 'UPLOAD_TYPE_NOT_ALLOWED',
          message: `File type ${extname(file.originalname) || '(none)'} is not accepted`,
        }),
        false,
      );
    },
  };
}

/** What an upload route answers: the authenticated download path, never a public URL. */
export function uploadedFileView(file: Express.Multer.File, request: unknown) {
  const tenantId = (tenantOf(request) ?? '').toLowerCase();
  return {
    originalName: file.originalname,
    filename: file.filename,
    path: `/api/uploads/files/${tenantId}/${file.filename}`,
    size: file.size,
    mimetype: file.mimetype,
  };
}
