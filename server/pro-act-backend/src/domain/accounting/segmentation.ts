import { secondsBetween } from '../actuals/decimal';
import { BoundedInterval, union } from '../time/interval-algebra';
import {
  LossEvent,
  PeriodAccountingInput,
  RateVersion,
  Segment,
  SegmentCause,
  SliceInput,
} from './accounting.types';
import { equalShares } from './shares';

/** Downtime events split by the micro-stop rule (D04 / KPI02) and planned-stop policy. */
export interface ClassifiedEvents {
  /** availability stops: occurrence duration ≥ the micro-stop threshold */
  stops: LossEvent[];
  /** micro-stops: shorter occurrences stay in running time and reduce performance */
  microStops: LossEvent[];
  /** planned stops moved out of scheduled time (policy false only; D04 default keeps them in A) */
  excludedStops: LossEvent[];
  /** fractional derates (`slowdown`, impact fraction set) */
  derates: LossEvent[];
}

/** An event's interval; a still-open event counts up to `asOf` (the run's instant, ≤ period end). */
export function boundedEvent(
  event: LossEvent,
  asOf: Date,
): BoundedInterval | null {
  const end = event.end ?? asOf;
  return end > event.start ? { start: event.start, end } : null;
}

/** Seconds of the occurrences whose full extent is known (DT-09), measured to `asOf` while open. */
function knownOccurrenceSeconds(
  input: PeriodAccountingInput,
): Map<string, number> {
  return new Map(
    (input.occurrences ?? []).map((o) => {
      const end = (o.end ?? input.asOf).getTime();
      return [o.occurrenceId, Math.max(0, end - o.start.getTime()) / 1000];
    }),
  );
}

/** Splits the eligible events by kind; the occurrence's full length decides stop vs micro-stop. */
export function classifyEvents(input: PeriodAccountingInput): ClassifiedEvents {
  const downtime = input.events.filter((e) => e.physicalType === 'downtime');
  const occurrenceSeconds = knownOccurrenceSeconds(input);
  for (const id of new Set(downtime.map((e) => e.occurrenceId))) {
    if (occurrenceSeconds.has(id)) continue;
    const parts = downtime
      .filter((e) => e.occurrenceId === id)
      .flatMap((e) => boundedEvent(e, input.asOf) ?? []);
    const seconds = union(parts).reduce(
      (sum, p) => sum + (p.end.getTime() - p.start.getTime()) / 1000,
      0,
    );
    occurrenceSeconds.set(id, seconds);
  }
  const isMicro = (e: LossEvent) =>
    (occurrenceSeconds.get(e.occurrenceId) ?? 0) <
    input.policy.microStopSeconds;
  const excludePlanned = (e: LossEvent) =>
    !input.policy.plannedStopsInsideScheduleReduceAvailability &&
    e.scheduleClass === 'planned';
  return {
    stops: downtime.filter((e) => !isMicro(e) && !excludePlanned(e)),
    microStops: downtime.filter((e) => isMicro(e) && !excludePlanned(e)),
    excludedStops: downtime.filter(excludePlanned),
    derates: input.events.filter(
      (e) =>
        e.physicalType === 'slowdown' &&
        e.impactMode === 'fractional' &&
        e.impactFraction !== null,
    ),
  };
}

function rateAt(
  rates: readonly RateVersion[] | null,
  at: Date,
): RateVersion | null {
  if (!rates) return null;
  return (
    rates.find((r) => r.from <= at && (r.to === null || r.to > at)) ?? null
  );
}

function activeIn(
  events: readonly LossEvent[],
  segment: BoundedInterval,
  asOf: Date,
): LossEvent[] {
  return events.filter((e) => {
    const bounded = boundedEvent(e, asOf);
    return (
      !!bounded && bounded.start <= segment.start && bounded.end >= segment.end
    );
  });
}

/**
 * One cause per occurrence (the earliest active event of it; split children never overlap, so a
 * split or merge leaves the causes of a segment unchanged), ordered by occurrence id, equal shares.
 */
export function causesOf(active: readonly LossEvent[]): SegmentCause[] {
  const byOccurrence = new Map<string, LossEvent>();
  const ordered = [...active].sort(
    (a, b) =>
      a.start.getTime() - b.start.getTime() ||
      a.eventId.localeCompare(b.eventId),
  );
  for (const event of ordered) {
    if (!byOccurrence.has(event.occurrenceId))
      byOccurrence.set(event.occurrenceId, event);
  }
  const causes = [...byOccurrence.values()].sort((a, b) =>
    a.occurrenceId.localeCompare(b.occurrenceId),
  );
  const shares = equalShares(causes.length);
  return causes.map((event, i) => ({ event, share: shares[i] }));
}

function boundaries(
  input: PeriodAccountingInput,
  slice: SliceInput,
  events: readonly LossEvent[],
): number[] {
  const { start, end } = slice.window;
  const times = new Set<number>([start.getTime(), end.getTime()]);
  const add = (time: Date | null) => {
    if (time && time > start && time < end) times.add(time.getTime());
  };
  for (const span of input.schedule) {
    add(span.start);
    add(span.end);
  }
  for (const event of events) {
    const bounded = boundedEvent(event, input.asOf);
    add(bounded?.start ?? null);
    add(bounded?.end ?? null);
  }
  for (const rate of [
    ...(slice.sustainedRates ?? []),
    ...slice.planningRates,
  ]) {
    add(rate.from);
    add(rate.to);
  }
  return [...times].sort((a, b) => a - b);
}

function isExcluded(
  input: PeriodAccountingInput,
  part: BoundedInterval,
  excludedStops: readonly LossEvent[],
): string | null | false {
  if (input.periodExcluded) return input.periodExclusionKind;
  const span = input.schedule.find(
    (s) => s.excluded && s.start <= part.start && s.end >= part.end,
  );
  if (span) return span.exclusionKind;
  return activeIn(excludedStops, part, input.asOf).length > 0
    ? 'planned_stop'
    : false;
}

/**
 * Atomic segments of a slice (ACC02): cut at the slice edges, schedule and exclusion edges, stop,
 * micro-stop and derate edges and rate-version changes; each carries its exclusion, rates and causes.
 */
export function segmentSlice(
  input: PeriodAccountingInput,
  slice: SliceInput,
): Segment[] {
  const classified = classifyEvents(input);
  const cutters = [
    ...classified.stops,
    ...classified.microStops,
    ...classified.excludedStops,
    ...classified.derates,
  ];
  const points = boundaries(input, slice, cutters);
  return points.slice(0, -1).map((from, i) => {
    const part = { start: new Date(from), end: new Date(points[i + 1]) };
    const exclusion = isExcluded(input, part, classified.excludedStops);
    const running = exclusion === false;
    return {
      ...part,
      seconds: secondsBetween(from, points[i + 1]),
      excluded: !running,
      exclusionKind: running ? null : exclusion || null,
      sustained: rateAt(slice.sustainedRates, part.start),
      planning: rateAt(slice.planningRates, part.start),
      stops: running
        ? causesOf(activeIn(classified.stops, part, input.asOf))
        : [],
      microStops: running
        ? causesOf(activeIn(classified.microStops, part, input.asOf))
        : [],
      derates: running ? activeIn(classified.derates, part, input.asOf) : [],
    };
  });
}
