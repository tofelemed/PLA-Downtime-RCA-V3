import { EntityManager } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { AuditEntry } from './audit-entry.entity';

/** One `audit_log` row; `actorId` null means `service` acted. */
export interface AuditDraft {
  tenantId: string;
  actorId: string | null;
  service?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  revision?: number | null;
  beforeHash?: string | null;
  afterHash?: string | null;
  reason?: string | null;
  correlationId?: string | null;
  detail?: Record<string, unknown>;
}

/**
 * Appends audit rows with `manager`, inside the caller's transaction: the command and its audit commit or
 * roll back together. The table refuses UPDATE and DELETE (trigger), so history is never rewritten.
 */
export async function appendAudit(
  manager: EntityManager,
  drafts: readonly AuditDraft[],
): Promise<void> {
  if (drafts.length === 0) return;
  await manager.insert(
    AuditEntry,
    drafts.map(
      (draft): QueryDeepPartialEntity<AuditEntry> => ({
        tenantId: draft.tenantId,
        actorId: draft.actorId,
        service: draft.service ?? null,
        action: draft.action,
        entityType: draft.entityType,
        entityId: draft.entityId,
        revision: draft.revision ?? null,
        beforeHash: draft.beforeHash ?? null,
        afterHash: draft.afterHash ?? null,
        reason: draft.reason ?? null,
        correlationId: draft.correlationId || null,
        // jsonb column: TypeORM's deep-partial type cannot express an open record
        detail: (draft.detail ?? {}) as QueryDeepPartialEntity<
          Record<string, unknown>
        >,
      }),
    ),
  );
}
