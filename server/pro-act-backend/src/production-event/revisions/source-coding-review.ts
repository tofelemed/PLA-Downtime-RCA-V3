import { EntityManager } from 'typeorm';
import { ProductionEvent } from '../production-event.entity';
import { EventReviewItem } from './event-review-item.entity';
import { EventRevision } from './event-revision.entity';

/** The reason a source delivery coded the event as: the resolved code (null when unresolved) and its raw token. */
export interface SourceCoding {
  reasonCodeId: string | null;
  reasonToken: string | null;
}

const KIND = 'source_reason_changed' as const;

/**
 * F2: codes are the user's layer and a source revision never re-codes an event. When the source resolves a
 * reason code other than the coded event's, one open `source_reason_changed` item (field `reason`) makes the
 * disagreement visible; a later revision resolving to the event's own code resolves it (`accepted_source`,
 * no person). An uncoded event or an unresolved token raises nothing (the intake quarantines unknown codes).
 */
export async function reviewSourceCoding(
  manager: EntityManager,
  event: ProductionEvent,
  sourceRevision: EventRevision,
  sourceCoding: SourceCoding | undefined,
): Promise<void> {
  const sourceCode = sourceCoding?.reasonCodeId;
  if (!sourceCode || !event.reasonCodeId) return;
  const items = manager.getRepository(EventReviewItem);
  if (sourceCode === event.reasonCodeId) {
    await items.update(
      { eventId: event.id, kind: KIND, state: 'open' },
      { state: 'accepted_source', resolvedBy: null, resolvedAt: new Date() },
    );
    return;
  }
  const open = await items.count({
    where: { eventId: event.id, kind: KIND, state: 'open' },
  });
  if (open > 0) return;
  await items.save(
    items.create({
      tenantId: sourceRevision.tenantId,
      eventId: event.id,
      kind: KIND,
      field: 'reason',
      sourceRevisionId: sourceRevision.id,
      codingRevisionId: null,
      state: 'open',
      createdBy: null,
      updatedBy: null,
    }),
  );
}
