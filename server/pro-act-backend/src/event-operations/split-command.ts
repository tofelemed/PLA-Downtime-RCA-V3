import { EntityManager } from 'typeorm';
import { RequestContext } from '../common/context/request-context';
import { splitAmount, splitInterval } from '../domain/events/event-operations';
import { ProductionEvent } from '../production-event/production-event.entity';
import { EventChangeMessage } from '../production-event/revisions/event-change.notifier';
import { Interval } from '../domain/time/interval-algebra';
import {
  actorFromContext,
  RevisionActor,
} from '../production-event/revisions/revision-actor';
import { insertDerivedEvent, relate, supersede } from './event-lineage';
import {
  derivedEventId,
  lockOperable,
  OperationResult,
} from './operation-support';

export interface SplitCommand {
  context: RequestContext;
  eventId: string;
  splitAt: Date;
  reason: string;
  expectedVersion: number;
  now: Date;
}

/**
 * DT09 split: two children `[start, splitAt)` and `[splitAt, end)` with the parent's attributes, coding
 * and occurrence (KPI06 count unchanged); quantity and cost are prorated by duration (sum conserved);
 * lineage `split_child_of`; the parent becomes `superseded` (no single successor).
 */
export async function splitIn(
  manager: EntityManager,
  command: SplitCommand,
): Promise<OperationResult> {
  const parent = await lockOperable(
    manager,
    command.context,
    command.eventId,
    command.expectedVersion,
  );
  const parts = splitInterval(
    { start: parent.startTime, end: parent.endTime ?? null },
    command.splitAt,
    command.now,
  );
  const actor = actorFromContext(command.context);
  const reason = `split of ${parent.id} at ${command.splitAt.toISOString()}: ${command.reason}`;
  const children = await insertChildren(manager, parent, parts, {
    actor,
    reason,
  });
  const message = await recordLineage(manager, parent, children, {
    actor,
    reason,
  });
  return {
    outcome: {
      operation: 'split',
      createdEventIds: children.map((child) => child.id),
      supersededEventIds: [parent.id],
      updatedEventIds: [],
      occurrenceId: parent.occurrenceId,
    },
    messages: [message],
  };
}

/** `split_child_of` rows child → parent; the parent superseded (no single successor). */
async function recordLineage(
  manager: EntityManager,
  parent: ProductionEvent,
  children: readonly ProductionEvent[],
  provenance: { actor: RevisionActor; reason: string },
): Promise<EventChangeMessage> {
  await relate(
    manager,
    children.map((child) => ({
      tenantId: child.tenantId as string,
      fromEventId: child.id,
      toEventId: parent.id,
      relationType: 'split_child_of' as const,
      occurrenceId: parent.occurrenceId,
      actorId: provenance.actor.id,
    })),
  );
  return supersede(manager, parent, { ...provenance, supersededBy: null });
}

/** The two children: parent attributes and occurrence, amounts prorated by duration. */
async function insertChildren(
  manager: EntityManager,
  parent: ProductionEvent,
  parts: [Interval, Interval],
  provenance: { actor: RevisionActor; reason: string },
): Promise<ProductionEvent[]> {
  const quantities = splitAmount(parent.quantity, parts);
  const costs = splitAmount(parent.cost, parts);
  const children: ProductionEvent[] = [];
  for (const [index, interval] of parts.entries()) {
    children.push(
      await insertDerivedEvent(manager, {
        ...provenance,
        template: parent,
        interval,
        columns: {
          occurrenceId: parent.occurrenceId,
          eventId: derivedEventId(parent.eventId, String(index + 1)),
          quantity: quantities[index],
          cost: costs[index],
        } as Partial<ProductionEvent>,
      }),
    );
  }
  return children;
}
