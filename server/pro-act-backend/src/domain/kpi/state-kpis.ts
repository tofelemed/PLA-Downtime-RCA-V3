import { Dec } from '../actuals/decimal';
import { PeriodAccountingInput } from '../accounting/accounting.types';
import {
  scheduledIntervals,
  stateCoverage,
} from '../reliability/state-coverage';
import { StateSegment } from '../reliability/unit-state';
import { KpiDraft, KpiMetric, KpiScope } from './kpi.types';

const PERIOD: KpiScope = { level: 'period' };

function draft(
  metric: KpiMetric,
  numerator: number,
  denominator: number,
  cohort: KpiDraft['cohort'],
): KpiDraft {
  const value = denominator > 0 ? new Dec(numerator).div(denominator) : null;
  return {
    metric,
    scope: PERIOD,
    numerator: new Dec(numerator),
    denominator: new Dec(denominator),
    value,
    unit: 'ratio',
    quality: value === null ? 'unavailable' : 'provisional',
    reason: value === null ? 'no_scheduled_time' : 'state_engine_bounds',
    cohort,
  };
}

/**
 * SME D2: known-data coverage of the scheduled time and the availability bounds from the unit's state
 * timeline (only units with a state mapping). Unknown time stays in the scheduled denominator; the bounds
 * are published instead of a certified availability, so both carry quality `provisional`. Coverage is
 * `ok` only when every scheduled second is known.
 */
export function stateKpis(
  input: PeriodAccountingInput,
  timeline: readonly StateSegment[],
): KpiDraft[] {
  const excluded = input.schedule.filter((s) => s.excluded);
  const scheduled = scheduledIntervals(
    input.window,
    excluded,
    input.periodExcluded,
  );
  const c = stateCoverage(timeline, scheduled);
  const cohort = {
    unknownSeconds: c.unknownSeconds,
    knownStoppedSeconds: c.knownStoppedSeconds,
    runningSeconds: c.runningSeconds,
    knownTimeAvailability: c.knownTimeAvailability,
    basis: 'state engine over scheduled time',
  };
  const coverage = draft(
    'state_coverage',
    c.runningSeconds + c.knownStoppedSeconds,
    c.scheduledSeconds,
    cohort,
  );
  const complete = coverage.value !== null && coverage.value.gte(1);
  return [
    complete
      ? { ...coverage, quality: 'ok', reason: null }
      : {
          ...coverage,
          reason:
            coverage.value === null ? 'no_scheduled_time' : 'unknown_time',
        },
    draft(
      'availability_lower_bound',
      c.runningSeconds,
      c.scheduledSeconds,
      cohort,
    ),
    draft(
      'availability_upper_bound',
      c.runningSeconds + c.unknownSeconds,
      c.scheduledSeconds,
      cohort,
    ),
  ];
}
