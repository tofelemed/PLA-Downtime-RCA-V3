/**
 * Half-open time intervals `[start, end)` in UTC (spec §3.3, DT05). `end === null` means the interval is
 * still running. Every function here is pure; durations are seconds at millisecond precision.
 */
export interface Interval {
  start: Date;
  end: Date | null;
}

/** A closed-off interval: both bounds known. */
export interface BoundedInterval {
  start: Date;
  end: Date;
}

const MS_PER_SECOND = 1000;

/** Seconds covered by `interval`; a running interval is measured up to `asOf` (0 if `asOf` is before it). */
export function durationSeconds(
  interval: Interval,
  asOf?: Date,
): number | null {
  const end = interval.end ?? asOf ?? null;
  if (!end) {
    return null;
  }
  return Math.max(0, end.getTime() - interval.start.getTime()) / MS_PER_SECOND;
}

/** Bounds a running interval at `asOf`; already bounded intervals are returned unchanged. */
export function boundAt(interval: Interval, asOf: Date): BoundedInterval {
  return {
    start: interval.start,
    end:
      interval.end ??
      new Date(Math.max(asOf.getTime(), interval.start.getTime())),
  };
}

/** Part of `interval` inside `window`, or null when they do not overlap (touching ends do not overlap). */
export function clip(
  interval: Interval,
  window: BoundedInterval,
): BoundedInterval | null {
  const start = Math.max(interval.start.getTime(), window.start.getTime());
  const intervalEnd = interval.end?.getTime() ?? Number.POSITIVE_INFINITY;
  const end = Math.min(intervalEnd, window.end.getTime());
  return end > start ? { start: new Date(start), end: new Date(end) } : null;
}

/**
 * Merged cover of `intervals`: sorted, non-overlapping, adjacent intervals joined. Empty intervals are
 * dropped. Commutative and idempotent; total duration never exceeds the sum of the inputs.
 */
export function union(
  intervals: readonly BoundedInterval[],
): BoundedInterval[] {
  const sorted = intervals
    .filter((interval) => interval.end.getTime() > interval.start.getTime())
    .map(
      (interval) => [interval.start.getTime(), interval.end.getTime()] as const,
    )
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: Array<[number, number]> = [];
  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }
  return merged.map(([start, end]) => ({
    start: new Date(start),
    end: new Date(end),
  }));
}

/** Total seconds of the union of `intervals` (DT05: a unit is down once however many assets stop). */
export function unionSeconds(intervals: readonly BoundedInterval[]): number {
  return union(intervals).reduce(
    (sum, interval) =>
      sum + (interval.end.getTime() - interval.start.getTime()) / MS_PER_SECOND,
    0,
  );
}

/**
 * Cuts `interval` at every boundary strictly inside it (shift, day, campaign, rate changes). The parts
 * are contiguous and their durations add up to the whole.
 */
export function splitAt(
  interval: BoundedInterval,
  boundaries: readonly Date[],
): BoundedInterval[] {
  const start = interval.start.getTime();
  const end = interval.end.getTime();
  const cuts = [...new Set(boundaries.map((boundary) => boundary.getTime()))]
    .filter((time) => time > start && time < end)
    .sort((a, b) => a - b);
  const points = [start, ...cuts, end];
  return points.slice(0, -1).map((point, index) => ({
    start: new Date(point),
    end: new Date(points[index + 1]),
  }));
}
