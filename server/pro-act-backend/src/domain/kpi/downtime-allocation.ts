import { secondsBetween } from '../actuals/decimal';
import { Dec } from '../actuals/decimal';
import { LossEvent, OverlapAllocation } from '../accounting/accounting.types';
import { boundedEvent, causesOf } from '../accounting/segmentation';
import { BoundedInterval } from '../time/interval-algebra';

/** Seconds of the window charged to one cause event (Σ over all causes = union of the stops). */
export interface CauseSeconds {
  event: LossEvent;
  seconds: Dec;
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
    for (const time of [bounded.start.getTime(), bounded.end.getTime()]) {
      if (time > from && time < to) points.add(time);
    }
  }
  return [...points].sort((a, b) => a - b);
}

/**
 * Downtime time by cause inside a window (KPI05 breakdowns): the window is cut at every stop edge; each
 * piece is shared equally by the occurrences active in it (one cause per occurrence — its earliest active
 * event, as in the 2.5 cause allocation), so split events never add time and the per-cause seconds always
 * add up to the union of the stops.
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
    for (const cause of causesOf(active, rule)) {
      result.push({ event: cause.event, seconds: seconds.mul(cause.share) });
    }
  }
  return result;
}
