import { SetMetadata } from '@nestjs/common';

export const AUDIT_READ_KEY = 'auditRead';

/**
 * Permission-sensitive read (plan 3.11, NFR03): a successful GET of this handler is written to the
 * audit log as `READ <entityType>` (raw source payloads, source samples). Export downloads audit
 * themselves.
 */
export const AuditRead = (entityType: string) =>
  SetMetadata(AUDIT_READ_KEY, entityType);
