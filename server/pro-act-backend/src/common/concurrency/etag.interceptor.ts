import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable, tap } from 'rxjs';
import { formatETag } from './revision';

/**
 * Sets `ETag` from the `rowVersion` of a single-resource response (API02), so clients can send it
 * back as `If-Match`. Responses without a numeric `rowVersion` (lists, envelopes) are left alone.
 */
@Injectable()
export class ETagInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const response = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      tap((body: unknown) => {
        const version = readRowVersion(body);
        if (version !== null) {
          response.setHeader('ETag', formatETag(version));
        }
      }),
    );
  }
}

function readRowVersion(body: unknown): number | null {
  if (typeof body !== 'object' || body === null || !('rowVersion' in body)) {
    return null;
  }
  const version = (body as { rowVersion: unknown }).rowVersion;
  return typeof version === 'number' ? version : null;
}
