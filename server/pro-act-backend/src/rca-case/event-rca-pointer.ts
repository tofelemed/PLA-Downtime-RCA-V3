import { EntityManager } from 'typeorm';
import { toLegacyStatus } from '../domain/events/legacy-status';
import { RcaState } from '../domain/events/event-classification';
import { ProductionEvent } from '../production-event/production-event.entity';
import { enqueueOutbox } from '../common/outbox/outbox-writer';
import { changeTypeOf } from '../production-event/revisions/event-change.notifier';
import { RevisionActor } from '../production-event/revisions/revision-actor';
import { applyUserChangeIn } from '../production-event/revisions/user-change';

/**
 * Moves a linked event's RCA state (DT11) through the event's user layer (plan 1.2 `applyUserChange`,
 * row lock, tenant check) instead of writing the columns directly: `linked` when a case is linked (the
 * legacy `rca_id` pointer is set only when empty), `completed` when its case closes. The RCA state is
 * a workflow state, so no coding is touched and no loss is attributed.
 */
export async function moveEventRcaState(
  manager: EntityManager,
  input: {
    eventId: string;
    tenantId: string;
    rcaId: string;
    state: Extract<RcaState, 'linked' | 'completed'>;
    actor: RevisionActor;
  },
): Promise<ProductionEvent | null> {
  const { result, message } = await applyUserChangeIn(manager, {
    actor: input.actor,
    eventId: input.eventId,
    tenantId: input.tenantId,
    reason: input.state === 'linked' ? 'RCA case linked' : 'RCA case closed',
    patch: (locked) => {
      const rcaState: RcaState =
        locked.rcaState === 'completed' ? 'completed' : input.state;
      return {
        rcaId: locked.rcaId ?? input.rcaId,
        rcaState,
        status: toLegacyStatus({
          physicalState: locked.physicalState,
          codingState: locked.codingState,
          rcaState,
        }),
      };
    },
  });
  if (message) {
    await enqueueOutbox(manager, [
      {
        tenantId: message.tenantId,
        aggregateType: 'production_event',
        aggregateId: message.eventId,
        type: changeTypeOf(message),
        version: message.revision,
        payload: { ...message },
      },
    ]);
  }
  return result;
}
