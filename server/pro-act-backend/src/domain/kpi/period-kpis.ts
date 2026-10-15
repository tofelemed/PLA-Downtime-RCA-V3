import { Dec, toDec } from '../actuals/decimal';
import {
  LedgerTotals,
  PeriodAccountingInput,
  SliceInput,
} from '../accounting/accounting.types';
import {
  classifyEvents,
  isPartialImpact,
  isStoppingDowntime,
  segmentSlice,
} from '../accounting/segmentation';
import { occurrenceThresholds } from '../accounting/micro-stop-threshold';
import { BoundedInterval } from '../time/interval-algebra';
import { downtimeBreakdown } from './downtime-breakdown';
import {
  downtimeMeasures,
  equivalentDowntimeKpi,
  OccurrenceSpan,
} from './downtime-measures';
import { idealTimes, IdealTimes, timeTerms, TimeTerms } from './ideal-time';
import { KpiDraft, KpiScope } from './kpi.types';
import { unavailable } from './kpi-values';
import { operationalOee } from './operational-oee';
import { reconciledFromTotals, sumReconciled } from './reconciled-terms';
import { reconciledOee } from './reconciled-oee';
import { FailureSpan, reliability } from './reliability';
import { stateKpis } from './state-kpis';
import { StateSegment } from '../reliability/unit-state';
import { StandbyExposure } from './standby-mtbf';

/** Bumped whenever a KPI rule changes (part of the calculation run's engine version and input hash). */
// 2.7.9: standby MTBF on own running time, controllable availability and incidents counted once (SME D9 / D15 / D5) together
export const KPI_ENGINE_VERSION = '2.7.9';

export interface PeriodKpiInput {
  /** the accounting input of the same run (window, schedule, events, slices, policy, asOf) */
  accounting: PeriodAccountingInput;
  /** the run's ledger totals (capacity ledger feeds the reconciled OEE) */
  totals: readonly LedgerTotals[];
  /** downtime occurrences touching the window, full extent */
  occurrences: readonly OccurrenceSpan[];
  /** functional-failure candidates touching the window (D13) */
  failures: readonly FailureSpan[];
  /** SME D1 / D2: the unit's state timeline; null / absent = no state mapping (no coverage KPIs) */
  stateTimeline?: readonly StateSegment[] | null;
  /** SME D9: standby assets of the unit with their own runs (their MTBF exposure) */
  standby?: readonly StandbyExposure[];
}

interface SliceTerms {
  slice: SliceInput;
  time: TimeTerms;
  ideal: IdealTimes;
}

const PERIOD: KpiScope = { level: 'period' };

function periodSlice(window: BoundedInterval): SliceInput {
  return {
    sliceId: 'period',
    window,
    uom: null,
    sustainedRates: null,
    planningRates: [],
    target: null,
    actuals: null,
    concurrent: false,
  };
}

function actualsIncomplete(slice: SliceInput): boolean {
  const state = slice.actuals?.qualityState;
  return state !== undefined && state !== null && state !== 'complete';
}

function sliceTerms(
  input: PeriodAccountingInput,
  window: BoundedInterval,
): SliceTerms[] {
  return input.slices.flatMap((slice) => {
    const start =
      slice.window.start > window.start ? slice.window.start : window.start;
    const end = slice.window.end < window.end ? slice.window.end : window.end;
    const clipped = {
      ...slice,
      window: { start, end: end > start ? end : start },
    };
    const segments = segmentSlice(input, clipped);
    return [
      {
        slice,
        time: timeTerms(segments),
        ideal: idealTimes(clipped, segments),
      },
    ];
  });
}

/** Σ U and Σ V over sequential product slices (ideal-time weighting); concurrent streams are not combined. */
function combinedIdeal(slices: readonly SliceTerms[]): IdealTimes {
  const none = (reason: string): IdealTimes => ({
    idealGross: null,
    idealGood: null,
    grossReason: reason,
    goodReason: reason,
  });
  if (slices.length === 0) return none('no_slices');
  if (slices.some((s) => s.slice.concurrent)) return none('concurrent_streams');
  const total = (pick: (i: IdealTimes) => Dec | null) =>
    slices.reduce<Dec | null>((sum, s) => {
      const value = pick(s.ideal);
      return sum === null || value === null ? null : sum.plus(value);
    }, new Dec(0));
  const firstReason = (pick: (i: IdealTimes) => string | null) =>
    slices.map((s) => pick(s.ideal)).find((r) => r !== null) ?? null;
  return {
    idealGross: total((i) => i.idealGross),
    idealGood: total((i) => i.idealGood),
    grossReason: firstReason((i) => i.grossReason),
    goodReason: firstReason((i) => i.goodReason),
  };
}

function oeeKpis(time: TimeTerms, slices: readonly SliceTerms[]): KpiDraft[] {
  const incomplete = slices.some((s) => actualsIncomplete(s.slice))
    ? 'actuals_incomplete'
    : null;
  const period = operationalOee(
    {
      ...time,
      ...combinedIdeal(slices),
      provisional: incomplete,
    },
    PERIOD,
  );
  const perSlice = slices.flatMap((s) =>
    operationalOee(
      {
        ...s.time,
        ...s.ideal,
        provisional: actualsIncomplete(s.slice) ? 'actuals_incomplete' : null,
      },
      sliceScope(s.slice),
    ),
  );
  return [...period, ...perSlice];
}

function sliceScope(slice: SliceInput): KpiScope {
  return {
    level: 'slice',
    sliceId: slice.sliceId,
    productId: slice.productId ?? null,
  };
}

function reconciledKpis(input: PeriodKpiInput): KpiDraft[] {
  const epsilon = new Dec(input.accounting.policy.epsilon);
  const perSlice = input.accounting.slices.map((slice) => ({
    slice,
    terms: reconciledFromTotals(slice, input.totals, epsilon),
  }));
  return [
    ...reconciledOee(sumReconciled(perSlice), PERIOD),
    ...perSlice.flatMap((p) => reconciledOee(p.terms, sliceScope(p.slice))),
  ];
}

function coverageKpi(slices: readonly SliceInput[]): KpiDraft {
  const target = { metric: 'coverage' as const, scope: PERIOD };
  const ratios = slices.map((s) => toDec(s.actuals?.coverageRatio ?? null));
  if (slices.length === 0)
    return unavailable(
      target,
      { numerator: null, denominator: null },
      'no_slices',
    );
  if (ratios.some((r) => r === null)) {
    return unavailable(
      target,
      { numerator: null, denominator: null },
      'coverage_unknown',
    );
  }
  const lowest = Dec.min(...(ratios as Dec[]));
  return {
    ...target,
    numerator: null,
    denominator: null,
    value: lowest,
    unit: 'ratio',
    quality: lowest.lt(1) ? 'provisional' : 'ok',
    reason: lowest.lt(1) ? 'actuals_coverage_below_1' : null,
    cohort: { basis: 'lowest actuals coverage of the slices' },
  };
}

/** S and D counting every stop inside the schedule (scheduled availability is not policy-dependent). */
function scheduledTerms(
  input: PeriodAccountingInput,
  window: BoundedInterval,
): TimeTerms {
  const everyStop = {
    ...input,
    policy: {
      ...input.policy,
      plannedStopsInsideScheduleReduceAvailability: true,
    },
  };
  return timeTerms(segmentSlice(everyStop, periodSlice(window)));
}

/**
 * SME D15: S and D of the controllable view, counting every stop inside the schedule except stops classed
 * external (feed, utilities, blocking); external time stays in S, so the denominator is the same.
 */
function controllableTerms(
  input: PeriodAccountingInput,
  window: BoundedInterval,
): TimeTerms {
  return scheduledTerms(
    {
      ...input,
      events: input.events.filter((e) => e.scheduleClass !== 'external'),
    },
    window,
  );
}

/** Occurrences of stops only: those seen in the window only through no-impact or partial events drop out (SME Q5). */
function stoppingOccurrences(input: PeriodKpiInput): OccurrenceSpan[] {
  const downtime = input.accounting.events.filter(
    (e) => e.physicalType === 'downtime',
  );
  const stopping = new Set(
    downtime.filter(isStoppingDowntime).map((e) => e.occurrenceId),
  );
  const notStopping = new Set(
    downtime
      .filter((e) => !isStoppingDowntime(e))
      .map((e) => e.occurrenceId)
      .filter((id) => !stopping.has(id)),
  );
  return input.occurrences.filter((o) => !notStopping.has(o.occurrenceId));
}

/**
 * All KPIs of one period and calculation run (plan 2.7; pure, decimal): operational OEE for the period and
 * each product slice, the reconciled PLA OEE from the capacity ledger, downtime measures and breakdowns,
 * reliability, and the actuals coverage. Like the ledgers, a running period uses its whole window (open
 * stops measured to the run instant); its draft revision makes every report of it provisional.
 */
export function computePeriodKpis(input: PeriodKpiInput): KpiDraft[] {
  const accounting = input.accounting;
  const window = accounting.window;
  const time = timeTerms(segmentSlice(accounting, periodSlice(window)));
  const slices = sliceTerms(accounting, window);
  const classified = classifyEvents(accounting);
  const downtimeInput = {
    window,
    asOf: accounting.asOf,
    events: accounting.events.filter(isStoppingDowntime),
    microOccurrences: new Set(classified.microStops.map((e) => e.occurrenceId)),
    occurrences: stoppingOccurrences(input),
    scheduled: scheduledTerms(accounting, window),
    controllable: controllableTerms(accounting, window),
    overlapAllocation: accounting.policy.overlapAllocation,
  };
  const downtime = downtimeMeasures(downtimeInput);
  return [
    ...oeeKpis(time, slices),
    ...reconciledKpis(input),
    ...downtime.kpis,
    equivalentDowntimeKpi(
      window,
      accounting.asOf,
      accounting.events.filter(isPartialImpact),
    ),
    ...downtimeBreakdown(downtimeInput, downtime.allocated),
    ...reliability({
      window,
      asOf: accounting.asOf,
      failures: input.failures,
      exposure: time.scheduled.minus(time.stopped),
      microStopSeconds: accounting.policy.microStopSeconds,
      microStopSecondsByOccurrence: occurrenceThresholds(
        downtimeInput.events,
        accounting.policy,
      ),
      standby: input.standby,
    }),
    coverageKpi(accounting.slices),
    ...(input.stateTimeline ? stateKpis(accounting, input.stateTimeline) : []),
  ];
}
