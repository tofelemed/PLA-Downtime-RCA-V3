import { Dec, secondsBetween } from '../actuals/decimal';
import { BoundedInterval } from '../time/interval-algebra';
import { KpiDraft, KpiScope, MDTR_LABEL } from './kpi.types';
import { ratioKpi, sum, unavailable } from './kpi-values';

export type FailureSource =
  | 'failure_work_order'
  | 'unplanned_stop_with_failure_code';

/** A functional-failure candidate (`failure_events_v`, D13): one per occurrence, full extent. */
export interface FailureSpan {
  occurrenceId: string;
  assetId: string | null;
  start: Date;
  /** restored at; null = still open */
  end: Date | null;
  source: FailureSource;
  /** active repair evidence: first and last CMMS operation of the repair (SME D10) */
  repairStart: Date | null;
  repairEnd: Date | null;
  /** SME D10: diagnosis + repair + test time minus waiting; absent = repairEnd − repairStart */
  activeRepairSeconds?: number | null;
}

export interface ReliabilityInput {
  window: BoundedInterval;
  asOf: Date;
  failures: readonly FailureSpan[];
  /** operating exposure: the unit's run time R in the window (seconds) */
  exposure: Dec;
  microStopSeconds: number;
  /** SME D6: threshold per stop occurrence (asset class, trips at 0); absent occurrences use the unit's */
  microStopSecondsByOccurrence?: ReadonlyMap<string, number>;
}

const lengthOf = (start: Date, end: Date) =>
  secondsBetween(start.getTime(), end.getTime());

/**
 * D13 eligibility: unplanned stops with a failure code shorter than the micro-stop threshold are not
 * failures (KPI07); a failure work order overlapping a coded stop of the same asset is the same failure
 * and is not counted twice. Slowdowns, planned stops and advisories never reach this list.
 */
export function eligibleFailures(input: ReliabilityInput): FailureSpan[] {
  const stops = input.failures.filter(
    (f) =>
      f.source === 'unplanned_stop_with_failure_code' &&
      lengthOf(f.start, f.end ?? input.asOf).gte(
        input.microStopSecondsByOccurrence?.get(f.occurrenceId) ??
          input.microStopSeconds,
      ),
  );
  const orders = input.failures.filter(
    (f) =>
      f.source === 'failure_work_order' &&
      !stops.some(
        (s) =>
          s.assetId === f.assetId &&
          s.start < (f.end ?? input.asOf) &&
          (s.end ?? input.asOf) > f.start,
      ),
  );
  return [...stops, ...orders];
}

function restoredIn(failures: readonly FailureSpan[], window: BoundedInterval) {
  return failures.filter(
    (f) => f.end !== null && f.end > window.start && f.end <= window.end,
  );
}

function mtbf(
  input: ReliabilityInput,
  failures: FailureSpan[],
  scope: KpiScope,
): KpiDraft {
  const started = failures.filter(
    (f) => f.start >= input.window.start && f.start < input.window.end,
  );
  return ratioKpi(
    { metric: 'mtbf', scope, unit: 's' },
    {
      numerator: input.exposure,
      denominator: new Dec(started.length),
      cohort: { exposureBasis: 'unit_run_time', failureDefinition: 'D13' },
    },
    'no_failures',
  );
}

function restoreMean(
  input: ReliabilityInput,
  failures: FailureSpan[],
  scope: KpiScope,
): KpiDraft {
  const fromStops = failures.filter(
    (f) => f.source === 'unplanned_stop_with_failure_code',
  );
  const restored = restoredIn(fromStops, input.window);
  return ratioKpi(
    { metric: 'mean_downtime_to_restore', scope, unit: 's' },
    {
      numerator: sum(restored.map((f) => lengthOf(f.start, f.end as Date))),
      denominator: new Dec(restored.length),
      cohort: {
        label: MDTR_LABEL,
        cohort: 'failures_restored_in_window',
        openCensored: fromStops.filter((f) => f.end === null).length,
        workOrderOnly: failures.length - fromStops.length,
      },
    },
    'no_restored_failures',
  );
}

/** KPI08 / SME D10: mean active repair time only from CMMS operation evidence of completed repairs; open repairs are censored. */
function mttr(
  input: ReliabilityInput,
  failures: FailureSpan[],
  scope: KpiScope,
): KpiDraft {
  const restored = restoredIn(failures, input.window);
  const evidenced = restored.filter((f) => f.repairStart && f.repairEnd);
  const cohort = {
    label: 'mean active repair time',
    withoutEvidence: restored.length - evidenced.length,
  };
  if (evidenced.length === 0) {
    return unavailable(
      { metric: 'mttr', scope, unit: 's' },
      { numerator: null, denominator: null, cohort },
      'repair_evidence_missing',
    );
  }
  const partial =
    evidenced.length < restored.length ? 'repair_evidence_partial' : null;
  return ratioKpi(
    { metric: 'mttr', scope, unit: 's' },
    {
      numerator: sum(
        evidenced.map((f) =>
          f.activeRepairSeconds != null
            ? new Dec(f.activeRepairSeconds)
            : lengthOf(f.repairStart as Date, f.repairEnd as Date),
        ),
      ),
      denominator: new Dec(evidenced.length),
      provisional: partial,
      cohort,
    },
    'no_repairs',
  );
}

/**
 * Reliability measures of KPI07 / KPI08 for the unit and for every asset with a failure in the window:
 * MTBF = operating exposure / eligible failures starting in the window (null with exposure and count when
 * there is none), mean downtime to restore over completed outages, MTTR only with repair evidence.
 */
export function reliability(input: ReliabilityInput): KpiDraft[] {
  const eligible = eligibleFailures(input);
  const unit: KpiScope = { level: 'period' };
  const results = [
    mtbf(input, eligible, unit),
    restoreMean(input, eligible, unit),
    mttr(input, eligible, unit),
  ];
  const assets = [
    ...new Set(eligible.flatMap((f) => (f.assetId ? [f.assetId] : []))),
  ].sort();
  for (const assetId of assets) {
    const own = eligible.filter((f) => f.assetId === assetId);
    const scope: KpiScope = { level: 'asset', assetId };
    results.push(
      mtbf(input, own, scope),
      restoreMean(input, own, scope),
      mttr(input, own, scope),
    );
  }
  return results;
}
