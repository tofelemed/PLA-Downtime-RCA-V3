import { NotFoundException } from '@nestjs/common';
import { existsSync } from 'fs';
import { join } from 'path';
import { RequestContext } from '../context/request-context';
import { UPLOAD_ROOT } from './upload-options';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const STORED_NAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{1,5}$/;
/** Inline-safe types; everything else downloads as an attachment. */
const INLINE_TYPES: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

export interface StoredAttachment {
  absolutePath: string;
  contentType: string;
  inline: boolean;
}

function notFound(): NotFoundException {
  return new NotFoundException({
    code: 'NOT_FOUND',
    message: 'File not found',
  });
}

function isMember(context: RequestContext, tenantId: string): boolean {
  return (
    context.isSuperAdmin ||
    context.tenantId?.toLowerCase() === tenantId ||
    context.scopes.some((scope) => scope.tenantId.toLowerCase() === tenantId)
  );
}

/**
 * Resolves `uploads/<tenantId>/<name>` for a caller (plan 3.11, owner decision 2026-10-10: downloads need a
 * token). Only stored names (uuid + extension) are accepted, so no path can leave the tenant folder; a
 * file of a tenant the caller does not belong to answers 404 like a missing one.
 */
export function resolveAttachment(
  context: RequestContext,
  tenantId: string,
  name: string,
): StoredAttachment {
  const tenant = tenantId.toLowerCase();
  const file = name.toLowerCase();
  if (
    !UUID.test(tenant) ||
    !STORED_NAME.test(file) ||
    !isMember(context, tenant)
  ) {
    throw notFound();
  }
  const absolutePath = join(UPLOAD_ROOT, tenant, file);
  if (!existsSync(absolutePath)) throw notFound();
  const extension = file.slice(file.lastIndexOf('.') + 1);
  const inlineType = INLINE_TYPES[extension];
  return {
    absolutePath,
    contentType: inlineType ?? 'application/octet-stream',
    inline: inlineType !== undefined,
  };
}
