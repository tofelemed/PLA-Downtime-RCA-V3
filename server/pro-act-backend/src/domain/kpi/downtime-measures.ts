import { Dec, secondsBetween, ZERO } from '../actuals/decimal';
import { LossEvent } from '../accounting/accounting.types';
import { BoundedInterval } from '../time/interval-algebra';
import { allocateDowntime, CauseSeconds } from './downtime-allocation';
import { TimeTerms } from './ideal-time';
import { KpiDraft, KpiScope, StopKind } from './kpi.types';
import { amountKpi, ratioKpi, sum } from './kpi-values';

/** A stop occurrence with its full extent over all its events (split children included). */
export interface OccurrenceSpan {
  occurrenceId: string;
  start: Date;
  /** null = still open */
  end: Date | null;
}

export interface DowntimeInput {
  /** the period window */
  window: BoundedInterval;
  /** open stops are measured to this instant */
  asOf: Date;
  /** downtime events touching the window */
  events: readonly LossEvent[];
  /** occurrences shorter than the micro-stop threshold (D04, KPI02) */
  microOccurrences: ReadonlySet<string>;
  occurrences: readonly OccurrenceSpan[];
  /** S and D with every stop inside the schedule counted (scheduled availability) */
  scheduled: TimeTerms;
}

const PERIOD: KpiScope = { level: 'period' };

export function stopKindOf(
  input: DowntimeInput,
  occurrenceId: string,
): StopKind {
  return input.microOccurrences.has(occurrenceId) ? 'micro' : 'availability';
}

function secondsWhere(
  allocated: readonly CauseSeconds[],
  input: DowntimeInput,
  keep: (event: LossEvent, kind: StopKind) => boolean,
): Dec {
  return sum(
    allocated
      .filter((a) => keep(a.event, stopKindOf(input, a.event.occurrenceId)))
      .map((a) => a.seconds),
  );
}

/** KPI05 durations: every stop second is charged once (shares), split by schedule class and stop kind. */
function durationKpis(
  input: DowntimeInput,
  allocated: CauseSeconds[],
): KpiDraft[] {
  const stops = (scheduleClass: string) =>
    secondsWhere(
      allocated,
      input,
      (e, kind) => kind === 'availability' && e.scheduleClass === scheduleClass,
    );
  const total = sum(allocated.map((a) => a.seconds));
  const at = (metric: KpiDraft['metric']) => ({ metric, scope: PERIOD });
  return [
    amountKpi(at('downtime_total'), total, {
      cohort: {
        within: 'period_window',
        external: stops('external').toFixed(),
      },
    }),
    amountKpi(at('downtime_planned'), stops('planned')),
    amountKpi(at('downtime_unplanned'), stops('unplanned')),
    amountKpi(at('unknown_time'), stops('unknown'), {
      cohort: { meaning: 'stop time with schedule class unknown' },
    }),
    amountKpi(
      at('microstop_time'),
      secondsWhere(allocated, input, (_e, kind) => kind === 'micro'),
    ),
  ];
}

const inWindow = (time: Date, window: BoundedInterval) =>
  time >= window.start && time < window.end;

/**
 * KPI06 over availability-stop occurrences: `stop_count` = occurrences starting in the window (split
 * fragments never count twice), `carry_in_count` = started earlier and still running into it, and
 * `mean_stop_duration` = full duration of the occurrences ending in the window (cohort labelled; open
 * stops are censored and only counted).
 */
function countKpis(input: DowntimeInput): KpiDraft[] {
  const { window } = input;
  const stops = input.occurrences.filter(
    (o) => stopKindOf(input, o.occurrenceId) === 'availability',
  );
  const started = stops.filter((o) => inWindow(o.start, window));
  const carriedIn = stops.filter(
    (o) => o.start < window.start && (o.end === null || o.end > window.start),
  );
  const completed = stops.filter(
    (o) => o.end !== null && o.end > window.start && o.end <= window.end,
  );
  const durations = completed.map((o) =>
    secondsBetween(o.start.getTime(), (o.end as Date).getTime()),
  );
  const count = (metric: KpiDraft['metric'], n: number) =>
    amountKpi({ metric, scope: PERIOD, unit: 'count' }, new Dec(n));
  return [
    count('stop_count', started.length),
    count('carry_in_count', carriedIn.length),
    ratioKpi(
      { metric: 'mean_stop_duration', scope: PERIOD, unit: 's' },
      {
        numerator: sum(durations),
        denominator: new Dec(completed.length),
        cohort: {
          cohort: 'completed_stops_ending_in_window',
          openCensored: stops.filter((o) => o.end === null).length,
        },
      },
      'no_completed_stops',
    ),
  ];
}

/** Scheduled availability (own denominator: scheduled time) and onstream factor (calendar time). */
function availabilityKpis(input: DowntimeInput, total: Dec): KpiDraft[] {
  const { scheduled, window } = input;
  const calendar = secondsBetween(window.start.getTime(), window.end.getTime());
  return [
    ratioKpi(
      { metric: 'scheduled_availability', scope: PERIOD },
      {
        numerator: scheduled.scheduled.minus(scheduled.stopped),
        denominator: scheduled.scheduled,
        cohort: { denominator: 'scheduled_time' },
      },
      'no_scheduled_time',
    ),
    ratioKpi(
      { metric: 'onstream_factor', scope: PERIOD },
      {
        numerator: calendar.minus(total),
        denominator: calendar,
        cohort: { denominator: 'calendar_time' },
      },
      'no_calendar_time',
    ),
  ];
}

/** Period downtime measures of KPI05 / KPI06 plus the allocation the breakdown rows are built from. */
export function downtimeMeasures(input: DowntimeInput): {
  kpis: KpiDraft[];
  allocated: CauseSeconds[];
} {
  const allocated = allocateDowntime(input.events, input.window, input.asOf);
  const total = allocated.reduce((s, a) => s.plus(a.seconds), ZERO);
  return {
    kpis: [
      ...durationKpis(input, allocated),
      ...countKpis(input),
      ...availabilityKpis(input, total),
    ],
    allocated,
  };
}

/**
 * SME Q5: equivalent downtime — rate lost by partial-impact events expressed as time at the reference
 * rate (fraction × duration inside the window). Kept apart from stopped time (`downtime_total`).
 */
export function equivalentDowntimeKpi(
  window: BoundedInterval,
  asOf: Date,
  partial: readonly LossEvent[],
): KpiDraft {
  const seconds = sum(
    partial.map((e) => {
      const start = Math.max(e.start.getTime(), window.start.getTime());
      const end = Math.min((e.end ?? asOf).getTime(), window.end.getTime());
      if (end <= start) return ZERO;
      return secondsBetween(start, end).mul(new Dec(e.impactFraction ?? 0));
    }),
  );
  return amountKpi({ metric: 'downtime_equivalent', scope: PERIOD }, seconds, {
    cohort: {
      meaning:
        'lost rate of partial-impact events as time at the reference rate',
    },
  });
}
