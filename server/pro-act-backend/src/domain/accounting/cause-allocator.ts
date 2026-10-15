import { LossEvent, OverlapAllocation, SegmentCause } from './accounting.types';
import { equalShares } from './shares';

const byStart = (a: LossEvent, b: LossEvent) =>
  a.start.getTime() - b.start.getTime() || a.eventId.localeCompare(b.eventId);

/** One cause per occurrence: its earliest active event (split children never overlap). */
function causePerOccurrence(active: readonly LossEvent[]): LossEvent[] {
  const byOccurrence = new Map<string, LossEvent>();
  for (const event of [...active].sort(byStart)) {
    if (!byOccurrence.has(event.occurrenceId))
      byOccurrence.set(event.occurrenceId, event);
  }
  return [...byOccurrence.values()].sort((a, b) =>
    a.occurrenceId.localeCompare(b.occurrenceId),
  );
}

/**
 * Plan 1.10 `CauseAllocator` (DT07, SME Q11 / D7): the one rule that shares an atomic segment between the
 * stop occurrences active in it, used by the loss ledgers (2.5 segmentation) and by the KPI downtime
 * breakdowns (2.7) alike. Each occurrence is one cause — its earliest active event, so a split or merge
 * never changes the allocation. `first_out` (default of `oee_policy` versions since S1) gives the whole
 * segment to the occurrence that started first; when it clears, later segments go to the cause still
 * active (D7: 10:00–10:30 motor + 10:05–10:45 chute → 30 min motor, 15 min chute). `equal_share` (older
 * versions) splits it equally, 8-place shares with the remainder on the last occurrence id (Σ = 1).
 * Deterministic and independent of arrival order (ties by start, then event / occurrence id). Pure.
 */
export function allocateCauses(
  active: readonly LossEvent[],
  rule: OverlapAllocation = 'equal_share',
): SegmentCause[] {
  const causes = causePerOccurrence(active);
  if (rule === 'first_out' && causes.length > 1) {
    const first = [...causes].sort(
      (a, b) =>
        a.start.getTime() - b.start.getTime() ||
        a.occurrenceId.localeCompare(b.occurrenceId),
    )[0];
    return [{ event: first, share: equalShares(1)[0] }];
  }
  const shares = equalShares(causes.length);
  return causes.map((event, i) => ({ event, share: shares[i] }));
}
