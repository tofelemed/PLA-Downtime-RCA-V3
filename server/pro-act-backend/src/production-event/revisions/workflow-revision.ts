import { EntityManager, In } from 'typeorm';
import { ProductionEvent } from '../production-event.entity';
import { changeMessage, EventChangeMessage } from './event-change.notifier';
import { EFFECTIVE_FIELDS, factsOf } from './event-facts';
import { EventRevision } from './event-revision.entity';
import { RevisionActor } from './revision-actor';
import { hasRevisionTenant } from './revision-store';

/** Why a workflow label was written (`event_revisions.change_reason`). */
export type WorkflowRevisionReason = 'verification' | 'failure_validation';

/**
 * Revisions of a workflow label already written to several locked events (SME D13 supervisor verification,
 * maintenance failure validation): one `user` revision per event with the acting person and `reason`, and
 * its `workflowOnly` change message for the outbox. The effective facts are unchanged by such a label, so
 * consumers that recompute from facts skip the message. Revision numbers come from one grouped read and
 * the rows from one multi-row insert, so a shift-wide verification costs no round trip per event.
 */
export async function appendWorkflowRevisions(
  manager: EntityManager,
  eventIds: readonly string[],
  input: { actor: RevisionActor; reason: WorkflowRevisionReason },
): Promise<EventChangeMessage[]> {
  if (eventIds.length === 0) return [];
  const events = (
    await manager
      .getRepository(ProductionEvent)
      .findBy({ id: In([...eventIds]) })
  ).filter(hasRevisionTenant);
  if (events.length === 0) return [];
  const next = await nextRevisionNumbers(
    manager,
    events.map((event) => event.id),
  );
  const numbered = events.map((event) => ({
    event,
    revision: next.get(event.id) ?? 1,
  }));
  await manager.insert(
    EventRevision,
    numbered.map(({ event, revision }) => ({
      tenantId: event.tenantId as string,
      eventId: event.id,
      revision,
      kind: 'user' as const,
      sourceFacts: null,
      effectiveFacts: factsOf(event, EFFECTIVE_FIELDS),
      changeReason: input.reason,
      actorId: input.actor.id,
      actorKind: input.actor.kind,
      sourceRevision: null,
      createdBy: input.actor.id,
      updatedBy: input.actor.id,
    })),
  );
  return numbered.map(({ event, revision }) => ({
    ...changeMessage(event, event, revision, 'user'),
    workflowOnly: true,
  }));
}

/** Next number of each event's revision sequence (all kinds), in one grouped query. */
async function nextRevisionNumbers(
  manager: EntityManager,
  eventIds: readonly string[],
): Promise<Map<string, number>> {
  const rows: Array<{ event_id: string; max: number | string }> =
    await manager.query(
      `SELECT "event_id", MAX("revision") AS "max" FROM "event_revisions"
        WHERE "event_id" = ANY($1::uuid[]) GROUP BY "event_id"`,
      [eventIds],
    );
  return new Map(rows.map((row) => [row.event_id, Number(row.max) + 1]));
}
