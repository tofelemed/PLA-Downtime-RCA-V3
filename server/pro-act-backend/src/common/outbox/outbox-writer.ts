import { EntityManager } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { OutboxMessage } from './outbox-message.entity';

/** A message to publish once the surrounding transaction commits. */
export interface OutboxDraft {
  tenantId: string;
  aggregateType: string;
  aggregateId: string;
  type: string;
  version?: number;
  payload: Record<string, unknown>;
  scope?: string | null;
}

/**
 * Writes outbox rows with `manager`, i.e. inside the caller's business transaction (FND02): the change
 * and its messages commit or roll back together. One multi-row INSERT per call; returns the new ids.
 */
export async function enqueueOutbox(
  manager: EntityManager,
  drafts: readonly OutboxDraft[],
): Promise<string[]> {
  if (drafts.length === 0) return [];
  const inserted = await manager.insert(
    OutboxMessage,
    drafts.map((draft) => ({
      tenantId: draft.tenantId,
      aggregateType: draft.aggregateType,
      aggregateId: draft.aggregateId,
      type: draft.type,
      version: draft.version ?? 0,
      // jsonb column: TypeORM's deep-partial type cannot express an open record
      payload: draft.payload as QueryDeepPartialEntity<Record<string, unknown>>,
      scope: draft.scope ?? null,
    })),
  );
  return inserted.identifiers.map((identifier) => String(identifier.id));
}
