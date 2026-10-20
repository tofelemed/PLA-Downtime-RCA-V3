import { Dec, secondsBetween, ZERO } from '../actuals/decimal';
import { LossEvent, OverlapAllocation } from '../accounting/accounting.types';
import {
  MicroStopPolicy,
  occurrenceThresholds,
} from '../accounting/micro-stop-threshold';
import { BoundedInterval } from '../time/interval-algebra';
import { allocateDowntime } from './downtime-allocation';
import { OccurrenceSpan } from './downtime-measures';
import { countedFailures, eligibleFailures, FailureSpan } from './reliability';

/** The `oee_policy` fields the calendar basis applies (micro-stop rule and overlap sharing). */
export type CalendarPolicy = MicroStopPolicy & {
  overlapAllocation?: OverlapAllocation;
};

/** One unit's stops over its production days that have no calculation run. */
export interface CalendarBasisInput {
  /** disjoint day windows of the unit (calendar time, clipped to the report window and to `asOf`) */
  days: readonly BoundedInterval[];
  /** open stops are measured to this instant */
  asOf: Date;
  /** stopping downtime events of the unit touching the days (no `none` / `fractional` impact) */
  events: readonly LossEvent[];
  /** full extent of each stop occurrence over all its events */
  occurrences: readonly OccurrenceSpan[];
  /** D13 failure candidates of the unit (`failure_events_v`) touching the days */
  failures: readonly FailureSpan[];
  policy: CalendarPolicy;
}

/** Summable terms of the calendar basis (decimal seconds and counts). */
export interface CalendarBasisTerms {
  calendarSeconds: Dec;
  downtimeSeconds: Dec;
  unplannedSeconds: Dec;
  stopCount: number;
  failureCount: number;
  /** calendar run time: calendar time minus stop time (MTBF exposure) */
  exposureSeconds: Dec;
}

export const EMPTY_TERMS: CalendarBasisTerms = {
  calendarSeconds: ZERO,
  downtimeSeconds: ZERO,
  unplannedSeconds: ZERO,
  stopCount: 0,
  failureCount: 0,
  exposureSeconds: ZERO,
};

const inAnyDay = (time: Date, days: readonly BoundedInterval[]) =>
  days.some((day) => time >= day.start && time < day.end);

/** Full length of each occurrence (to `asOf` while open); occurrences without a span use their events. */
function occurrenceSeconds(input: CalendarBasisInput): Map<string, Dec> {
  const lengths = new Map<string, Dec>();
  for (const span of input.occurrences) {
    const end = span.end ?? input.asOf;
    lengths.set(
      span.occurrenceId,
      secondsBetween(
        span.start.getTime(),
        Math.max(end.getTime(), span.start.getTime()),
      ),
    );
  }
  for (const event of input.events) {
    if (lengths.has(event.occurrenceId)) continue;
    const end = event.end ?? input.asOf;
    lengths.set(
      event.occurrenceId,
      secondsBetween(
        event.start.getTime(),
        Math.max(end.getTime(), event.start.getTime()),
      ),
    );
  }
  return lengths;
}

/** SME D6: occurrences shorter than their micro-stop threshold stay in run time (as in the KPI engine). */
export function microOccurrences(input: CalendarBasisInput): Set<string> {
  const thresholds = occurrenceThresholds(input.events, input.policy);
  const lengths = occurrenceSeconds(input);
  const micro = new Set<string>();
  for (const [id, threshold] of thresholds) {
    const length = lengths.get(id);
    if (length && length.lt(threshold)) micro.add(id);
  }
  return micro;
}

/** Stop seconds of one day by the plan 1.10 allocation: total, and unplanned availability stops. */
function daySeconds(
  input: CalendarBasisInput,
  day: BoundedInterval,
  micro: ReadonlySet<string>,
): { total: Dec; unplanned: Dec } {
  const allocated = allocateDowntime(
    input.events,
    day,
    input.asOf,
    input.policy.overlapAllocation ?? 'equal_share',
  );
  let total = ZERO;
  let unplanned = ZERO;
  for (const part of allocated) {
    total = total.plus(part.seconds);
    const isStop = !micro.has(part.event.occurrenceId);
    if (isStop && part.scheduleClass === 'unplanned') {
      unplanned = unplanned.plus(part.seconds);
    }
  }
  return { total, unplanned };
}

/** D13 failures (micro-stop rule per occurrence, incidents once) starting inside one of the days. */
function failuresStarted(
  input: CalendarBasisInput,
  hull: BoundedInterval,
  exposure: Dec,
): number {
  const eligible = eligibleFailures({
    window: hull,
    asOf: input.asOf,
    failures: input.failures,
    exposure,
    microStopSeconds: input.policy.microStopSeconds,
    microStopSecondsByOccurrence: occurrenceThresholds(
      input.events,
      input.policy,
    ),
  });
  return countedFailures(eligible).filter((f) => inAnyDay(f.start, input.days))
    .length;
}

/**
 * Calendar-basis terms of one unit (plan 2.3): over its production days without a calculation run, the
 * window is calendar time (24 h per plant day, clipped), every stop second is charged once through the
 * same overlap allocation as the KPI engine (`allocateDowntime`), and:
 * - downtime = all stop time (micro-stops included, as `downtime_total`);
 * - unplanned = availability stops classed unplanned (maintenance overrun included, micro-stops not);
 * - stop count = availability-stop occurrences starting inside the days (split fragments once);
 * - failures = D13 eligible failures (incidents once) starting inside the days, over calendar run time.
 */
export function calendarBasisTerms(
  input: CalendarBasisInput,
): CalendarBasisTerms {
  if (input.days.length === 0) return EMPTY_TERMS;
  const micro = microOccurrences(input);
  let calendar = ZERO;
  let downtime = ZERO;
  let unplanned = ZERO;
  for (const day of input.days) {
    calendar = calendar.plus(
      secondsBetween(day.start.getTime(), day.end.getTime()),
    );
    const seconds = daySeconds(input, day, micro);
    downtime = downtime.plus(seconds.total);
    unplanned = unplanned.plus(seconds.unplanned);
  }
  const exposure = calendar.minus(downtime);
  const hull = {
    start: input.days[0].start,
    end: input.days[input.days.length - 1].end,
  };
  return {
    calendarSeconds: calendar,
    downtimeSeconds: downtime,
    unplannedSeconds: unplanned,
    stopCount: input.occurrences.filter(
      (o) => !micro.has(o.occurrenceId) && inAnyDay(o.start, input.days),
    ).length,
    failureCount: failuresStarted(input, hull, exposure),
    exposureSeconds: exposure,
  };
}

/** Σ of the terms of several units or days (each term summed, never an average of values). */
export function sumTerms(
  terms: readonly CalendarBasisTerms[],
): CalendarBasisTerms {
  return terms.reduce(
    (total, t) => ({
      calendarSeconds: total.calendarSeconds.plus(t.calendarSeconds),
      downtimeSeconds: total.downtimeSeconds.plus(t.downtimeSeconds),
      unplannedSeconds: total.unplannedSeconds.plus(t.unplannedSeconds),
      stopCount: total.stopCount + t.stopCount,
      failureCount: total.failureCount + t.failureCount,
      exposureSeconds: total.exposureSeconds.plus(t.exposureSeconds),
    }),
    EMPTY_TERMS,
  );
}
