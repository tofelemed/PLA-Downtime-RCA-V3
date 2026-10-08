import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
  PreconditionFailedException,
} from '@nestjs/common';
import { Request } from 'express';
import { PreconditionRequiredException } from '../errors/precondition-required.exception';

/** ETag value for a row version: a strong, quoted validator (`"3"`). */
export function formatETag(rowVersion: number): string {
  return `"${rowVersion}"`;
}

/**
 * Parses `If-Match: "<row_version>"` (API02). Missing → 428 `REVISION_REQUIRED`; anything but one
 * quoted (or bare) positive integer → 400 `INVALID_IF_MATCH`. `*` and lists are not supported.
 */
export function parseIfMatch(header: string | string[] | undefined): number {
  const raw = (Array.isArray(header) ? header[0] : header)?.trim();
  if (!raw) {
    throw new PreconditionRequiredException(
      'REVISION_REQUIRED',
      'This update requires an If-Match header with the current ETag',
    );
  }
  const match = /^(?:W\/)?"?(\d+)"?$/.exec(raw);
  const version = match ? Number.parseInt(match[1], 10) : Number.NaN;
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new BadRequestException({
      code: 'INVALID_IF_MATCH',
      message:
        'If-Match must be the ETag returned by a previous read, e.g. "3"',
    });
  }
  return version;
}

/** 412 `STALE_REVISION` unless the stored row version is the one the caller read. */
export function assertRevision(current: number, expected: number): void {
  if (current !== expected) {
    throw staleRevision(`current revision ${current}`);
  }
}

/** 412 `STALE_REVISION`, e.g. when a conditional `UPDATE ... AND row_version = :expected` matched nothing. */
export function staleRevision(
  detail = 'it was modified concurrently',
): PreconditionFailedException {
  return new PreconditionFailedException({
    code: 'STALE_REVISION',
    message: `The resource changed since it was read (${detail})`,
  });
}

/** Handler parameter: the expected row version from `If-Match` (428/400 as in `parseIfMatch`). */
export const IfMatch = createParamDecorator(
  (_data: unknown, context: ExecutionContext): number =>
    parseIfMatch(
      context.switchToHttp().getRequest<Request>().headers['if-match'],
    ),
);
