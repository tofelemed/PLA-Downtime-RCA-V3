import { DECLARED_CONFIRMED_STATUS } from '../events/declared-figures';

/**
 * D8: whether OT has confirmed a production loss event. A feed event carries the OT status and is
 * confirmed only when it says `CONFIRMED`; a manual event is confirmed unless it states another status
 * (a person entering the figures has no OT status to wait for).
 */
export function isDeclaredConfirmed(
  sourceKind: string,
  sourceStatus: string | null,
): boolean {
  if (sourceKind === 'manual') {
    return sourceStatus === null || sourceStatus === DECLARED_CONFIRMED_STATUS;
  }
  return sourceStatus === DECLARED_CONFIRMED_STATUS;
}
