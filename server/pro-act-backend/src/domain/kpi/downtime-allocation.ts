import { secondsBetween } from '../actuals/decimal';
import { Dec } from '../actuals/decimal';
import { LossEvent, OverlapAllocation } from '../accounting/accounting.types';
import { allocateCauses } from '../accounting/cause-allocator';
import { boundedEvent } from '../accounting/segmentation';
import { BoundedInterval } from '../time/interval-algebra';

/** Seconds of the window charged to one cause event (Σ over all causes = union of the stops). */
export interface CauseSeconds {
  event: LossEvent;
  seconds: Dec;
  /** the event's schedule class, `unplanned` for a maintenance overrun piece (SME D4) */
  scheduleClass: string;
  /** true after a planned stop's approved end (SME D4) */
  overrun: boolean;
}

/** Approved end of a planned stop's window, when the stop has one (SME D4). */
function plannedEndOf(event: LossEvent): Date | null {
  return event.scheduleClass === 'planned' ? (event.plannedEnd ?? null) : null;
}

function cutPoints(
  events: readonly LossEvent[],
  window: BoundedInterval,
  asOf: Date,
): number[] {
  const from = window.start.getTime();
  const to = window.end.getTime();
  const points = new Set<number>([from, to]);
  for (const event of events) {
    const bounded = boundedEvent(event, asOf);
    if (!bounded) continue;
    const plannedEnd = plannedEndOf(event)?.getTime();
    const edges = [bounded.start.getTime(), bounded.end.getTime()];
    if (plannedEnd !== undefined) edges.push(plannedEnd);
    for (const time of edges) {
      if (time > from && time < to) points.add(time);
    }
  }
  return [...points].sort((a, b) => a - b);
}

/**
 * Downtime time by cause inside a window (KPI05 breakdowns): the window is cut at every stop edge; each
 * piece is shared by the occurrences active in it through the plan 1.10 `CauseAllocator` the ledgers use
 * (one cause per occurrence, first-out or equal share by policy), so split events never add time and the
 * per-cause seconds always add up to the union of the stops. A planned stop's approved end is a cut too: time after it is the stop's
 * unplanned overrun (SME D4).
 */
export function allocateDowntime(
  events: readonly LossEvent[],
  window: BoundedInterval,
  asOf: Date,
  rule: OverlapAllocation = 'equal_share',
): CauseSeconds[] {
  const points = cutPoints(events, window, asOf);
  const result: CauseSeconds[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = new Date(points[i]);
    const end = new Date(points[i + 1]);
    const active = events.filter((event) => {
      const bounded = boundedEvent(event, asOf);
      return !!bounded && bounded.start <= start && bounded.end >= end;
    });
    if (active.length === 0) continue;
    const seconds = secondsBetween(points[i], points[i + 1]);
    for (const cause of allocateCauses(active, rule)) {
      const plannedEnd = plannedEndOf(cause.event);
      const overrun = plannedEnd !== null && start >= plannedEnd;
      result.push({
        event: cause.event,
        seconds: seconds.mul(cause.share),
        scheduleClass: overrun ? 'unplanned' : cause.event.scheduleClass,
        overrun,
      });
    }
  }
  return result;
}
