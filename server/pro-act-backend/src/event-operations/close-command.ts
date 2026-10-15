import { ConflictException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { RequestContext } from '../common/context/request-context';
import { validateCloseEnd } from '../domain/events/event-operations';
import { prepareUpdate } from '../production-event/event-write-model';
import { ProductionEvent } from '../production-event/production-event.entity';
import { EventChangeMessage } from '../production-event/revisions/event-change.notifier';
import { EventCoding } from '../production-event/revisions/event-coding.entity';
import {
  changedFields,
  EFFECTIVE_FIELDS,
  factsOf,
} from '../production-event/revisions/event-facts';
import { EventReviewItem } from '../production-event/revisions/event-review-item.entity';
import { actorFromContext } from '../production-event/revisions/revision-actor';
import {
  latestSourceRevision,
  writeEvent,
} from '../production-event/revisions/revision-store';
import { appendUserRevisions } from '../production-event/revisions/user-change';
import { lockOperable, OperationResult } from './operation-support';

export interface CloseCommand {
  context: RequestContext;
  eventId: string;
  endTime: Date;
  reason: string;
  expectedVersion: number;
  now: Date;
}

/**
 * DT10 close of an open stop (closing is not approving, DT11): a user revision sets the end. On a
 * source-owned event the end is a user override of the source (`user_overrides.endTime`, coding
 * revision flagged as override) and a `pending_source_confirmation` review item waits until a source
 * revision delivers the same end (then it is resolved automatically).
 */
export async function closeIn(
  manager: EntityManager,
  command: CloseCommand,
): Promise<OperationResult> {
  const event = await lockOperable(
    manager,
    command.context,
    command.eventId,
    command.expectedVersion,
  );
  if (event.endTime) {
    throw new ConflictException({
      code: 'EVENT_NOT_OPEN',
      message: 'Only an open event can be closed',
    });
  }
  validateCloseEnd(event.startTime, command.endTime, command.now);
  const sourceOwned = event.sourceKind !== 'manual';
  const codingRevision = event.currentCodingRevision + 1;
  const message = await writeClose(manager, event, {
    command,
    sourceOwned,
    codingRevision,
  });
  if (sourceOwned) {
    await openPendingConfirmation(manager, event, codingRevision);
  }
  return {
    outcome: {
      operation: 'close',
      createdEventIds: [],
      supersededEventIds: [],
      updatedEventIds: [event.id],
      occurrenceId: event.occurrenceId,
    },
    messages: [message],
  };
}

/** End, states and legacy status written; coding + effective user revision (override when source-owned). */
async function writeClose(
  manager: EntityManager,
  event: ProductionEvent,
  input: {
    command: CloseCommand;
    sourceOwned: boolean;
    codingRevision: number;
  },
): Promise<EventChangeMessage> {
  const { command, sourceOwned, codingRevision } = input;
  const overrides = sourceOwned
    ? { userOverrides: { ...event.userOverrides, endTime: codingRevision } }
    : {};
  const updated = await writeEvent(manager, event.id, {
    ...(prepareUpdate(event, {
      endTime: command.endTime,
    }) as Partial<ProductionEvent>),
    currentCodingRevision: codingRevision,
    ...overrides,
  });
  return appendUserRevisions(manager, event, updated, {
    actor: actorFromContext(command.context),
    fields: changedFields(
      factsOf(event, EFFECTIVE_FIELDS),
      factsOf(updated, EFFECTIVE_FIELDS),
    ),
    reason: `close: ${command.reason}`,
    overridesSourceRevision: sourceOwned ? event.currentSourceRevision : null,
  });
}

async function openPendingConfirmation(
  manager: EntityManager,
  event: ProductionEvent,
  codingRevision: number,
): Promise<void> {
  const source = await latestSourceRevision(manager, event.id);
  const coding = await manager.getRepository(EventCoding).findOne({
    where: { eventId: event.id, revision: codingRevision },
    select: { id: true },
  });
  const items = manager.getRepository(EventReviewItem);
  await items.save(
    items.create({
      tenantId: event.tenantId as string,
      eventId: event.id,
      kind: 'pending_source_confirmation',
      field: 'endTime',
      sourceRevisionId: source?.id ?? null,
      codingRevisionId: coding?.id ?? null,
      state: 'open',
      createdBy: null,
      updatedBy: null,
    }),
  );
}
