import { RcaAction } from '../rca/entities/rca-action.entity';
import { invalidBody } from './rca-scope';

type CancellationFields = Pick<
  RcaAction,
  'status' | 'cancelReason' | 'cancelledBy' | 'cancelledAt'
>;

/**
 * F-9: the cancellation of an action keeps who cancelled it, when, and the optional reason. Moving to
 * cancelled stamps the actor and time; a cancelled action may get or change its reason later; leaving
 * cancelled (reopening) clears all three. A reason on an action that is not cancelled is refused
 * (422 CANCEL_REASON_WITHOUT_CANCEL). `cancelReason` undefined = not sent.
 */
export function applyCancellation(
  previousStatus: RcaAction['status'] | null,
  next: CancellationFields,
  input: {
    cancelReason: string | null | undefined;
    actorId: string | null;
    now: Date;
  },
): void {
  if (next.status !== 'cancelled') {
    if (input.cancelReason) {
      throw invalidBody(
        'CANCEL_REASON_WITHOUT_CANCEL',
        'cancelReason',
        'a cancellation reason is recorded only when the action is cancelled',
      );
    }
    next.cancelReason = null;
    next.cancelledBy = null;
    next.cancelledAt = null;
    return;
  }
  if (previousStatus !== 'cancelled') {
    next.cancelledBy = input.actorId;
    next.cancelledAt = input.now;
    next.cancelReason = input.cancelReason ?? null;
    return;
  }
  if (input.cancelReason !== undefined) next.cancelReason = input.cancelReason;
}
