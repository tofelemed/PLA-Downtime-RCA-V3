import { secondsBetween } from '../actuals/decimal';
import { BoundedInterval, union } from '../time/interval-algebra';
import {
  LossEvent,
  OverlapAllocation,
  PeriodAccountingInput,
  RateVersion,
  Segment,
  SegmentCause,
  SliceInput,
} from './accounting.types';
import { occurrenceThresholds } from './micro-stop-threshold';
import { equalShares } from './shares';
import { eventsOfStream, slicePieces, StreamPiece } from './streams';

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
  /** grade transitions (LA-08) */
  transitions: LossEvent[];
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

/**
 * Downtime that does not stop the unit (SME Q5): `none` = the equipment failed but output held (standby),
 * no production loss; `fractional` = throughput reduced, a rate loss at its fraction (a derate), never
 * stopped time.
 */
const NOT_STOPPING = new Set(['none', 'fractional']);

/** A downtime event that stops the unit (counts as stopped time). */
export function isStoppingDowntime(e: LossEvent): boolean {
  return e.physicalType === 'downtime' && !NOT_STOPPING.has(e.impactMode);
}

/** A downtime or slowdown event that reduces the rate by a fraction (a derate). */
export function isPartialImpact(e: LossEvent): boolean {
  return (
    (e.physicalType === 'slowdown' || e.physicalType === 'downtime') &&
    e.impactMode === 'fractional' &&
    e.impactFraction !== null
  );
}

/** Splits the eligible events by kind; the occurrence's full length decides stop vs micro-stop. */
export function classifyEvents(input: PeriodAccountingInput): ClassifiedEvents {
  const downtime = input.events.filter(isStoppingDowntime);
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
  // SME D6: threshold per asset class; trips and functional failures are never micro-stops
  const thresholds = occurrenceThresholds(downtime, input.policy);
  const isMicro = (e: LossEvent) =>
    (occurrenceSeconds.get(e.occurrenceId) ?? 0) <
    (thresholds.get(e.occurrenceId) ?? input.policy.microStopSeconds);
  const excludePlanned = (e: LossEvent) =>
    !input.policy.plannedStopsInsideScheduleReduceAvailability &&
    e.scheduleClass === 'planned';
  return {
    stops: downtime.filter((e) => !isMicro(e) && !excludePlanned(e)),
    microStops: downtime.filter((e) => isMicro(e) && !excludePlanned(e)),
    excludedStops: downtime.filter(excludePlanned),
    derates: input.events.filter(isPartialImpact),
    transitions: input.events.filter(
      (e) => e.physicalType === 'grade_transition',
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
 * split or merge leaves the causes of a segment unchanged), ordered by occurrence id, equal shares —
 * or, with `first_out`, the whole segment to the occurrence that started first (SME Q11).
 */
export function causesOf(
  active: readonly LossEvent[],
  rule: OverlapAllocation = 'equal_share',
): SegmentCause[] {
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

/** Atomic segments of one window of a slice (no streams: the slice window, share 1). */
function segmentWindow(
  input: PeriodAccountingInput,
  slice: SliceInput,
  piece: StreamPiece | null,
): Segment[] {
  const classified = classifyEvents(input);
  const cutters = [
    ...classified.stops,
    ...classified.microStops,
    ...classified.excludedStops,
    ...classified.derates,
    ...classified.transitions,
  ];
  const points = boundaries(input, slice, cutters);
  return points.slice(0, -1).map((from, i) => {
    const part = { start: new Date(from), end: new Date(points[i + 1]) };
    const exclusion = isExcluded(input, part, classified.excludedStops);
    const running = exclusion === false;
    const causes = (events: readonly LossEvent[]) =>
      running
        ? causesOf(
            activeIn(events, part, input.asOf),
            input.policy.overlapAllocation,
          )
        : [];
    return {
      ...part,
      seconds: secondsBetween(from, points[i + 1]),
      excluded: !running,
      exclusionKind: running ? null : exclusion || null,
      sustained: rateAt(slice.sustainedRates, part.start),
      planning: rateAt(slice.planningRates, part.start),
      stops: causes(classified.stops),
      microStops: causes(classified.microStops),
      derates: running ? activeIn(classified.derates, part, input.asOf) : [],
      transitions: causes(classified.transitions),
      ...(piece
        ? { capacityShare: piece.share, streamId: piece.streamId }
        : {}),
    };
  });
}

/**
 * Atomic segments of a slice (ACC02): cut at the slice edges, schedule and exclusion edges, stop,
 * micro-stop, derate and grade-transition edges and rate-version changes; each carries its exclusion,
 * rates and causes. With `streamed` and streams configured (SME E6 / LA-10), the slice is segmented per
 * stream run of its product instead: each segment carries the stream's capacity share and only the
 * events of that stream or of the whole unit, so concurrent products never count the unit's capacity
 * twice. The KPI engine segments without streams (unit time, unchanged).
 */
export function segmentSlice(
  input: PeriodAccountingInput,
  slice: SliceInput,
  streamed = false,
): Segment[] {
  const pieces = streamed ? slicePieces(input, slice) : null;
  if (!pieces) return segmentWindow(input, slice, null);
  return pieces
    .flatMap((piece) =>
      segmentWindow(
        { ...input, events: eventsOfStream(input.events, piece.streamId) },
        { ...slice, window: piece.window },
        piece,
      ),
    )
    .sort(
      (a, b) =>
        a.start.getTime() - b.start.getTime() ||
        (a.streamId ?? '').localeCompare(b.streamId ?? ''),
    );
}
