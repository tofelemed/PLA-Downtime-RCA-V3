import { ConflictException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { RequestContext } from '../common/context/request-context';
import { actorFromContext } from '../production-event/revisions/revision-actor';
import { retractIn } from '../production-event/revisions/source-revision';
import { lockOperable, OperationResult } from './operation-support';

export interface RetractCommand {
  context: RequestContext;
  eventId: string;
  reason: string;
  expectedVersion: number;
}

/**
 * User retraction of a manual event (v2 equivalent of the v1 delete): events are append-only, so the
 * event is tombstoned — physical state `retracted`, `retracted_at`, legacy status, a `retraction`
 * revision — and the change message requests the recalculation of its window. Events delivered by a
 * connected source are retracted by their source only (409 SOURCE_OWNED).
 */
export async function retractEventIn(
  manager: EntityManager,
  command: RetractCommand,
): Promise<OperationResult> {
  const event = await lockOperable(
    manager,
    command.context,
    command.eventId,
    command.expectedVersion,
  );
  if (event.sourceKind !== 'manual') {
    throw new ConflictException({
      code: 'SOURCE_OWNED',
      message:
        'Events delivered by a connected source are retracted by their source',
    });
  }
  const { message } = await retractIn(manager, event.id, {
    actor: actorFromContext(command.context),
    reason: command.reason,
  });
  return {
    outcome: {
      operation: 'retract',
      createdEventIds: [],
      supersededEventIds: [],
      updatedEventIds: [event.id],
      occurrenceId: event.occurrenceId,
    },
    messages: message ? [message] : [],
  };
}
