import { Dec, formatDec, ZERO } from '../../domain/actuals/decimal';
import { planSteps } from '../../domain/reconciliation/waterfall';
import { PeriodState } from '../period-overview/period-states';
import { TrendGroup } from './pla-reports.dto';

/** One site-local bucket and unit of measure of the reconciliation trend (decimal strings, ≥ 0). */
export interface ReconciliationTrendBucketView {
  key: string;
  uom: string | null;
  /**
   * Σ positive residuals after decisions (the waterfall's "Unaccounted residual", as a magnitude); the three
   * figures are null when no slice of the bucket is computable (never a fabricated 0)
   */
  unaccounted: string | null;
  /** Σ negative residuals (the waterfall's "Over-accounted", as a magnitude) */
  overAccounted: string | null;
  /** Σ output above target (the waterfall's "Overproduction") */
  overproduction: string | null;
  periods: number;
  /** slices left out because a figure is unknown (no target, actual or run) */
  excludedSlices: number;
}

export interface ReconciliationTrendView {
  groupBy: TrendGroup;
  ledger: 'plan';
  buckets: ReconciliationTrendBucketView[];
  calculationRunIds: string[];
}

interface Bucket {
  key: string;
  uom: string | null;
  unaccounted: Dec;
  overAccounted: Dec;
  overproduction: Dec;
  periods: Set<string>;
  included: number;
  excluded: number;
}

/** ISO 8601 week of an operational date (`YYYY-"W"WW`, the same key as the 2.7 SQL `IYYY-"W"IW`). */
export function isoWeek(localDate: string): string {
  const date = new Date(`${localDate}T00:00:00Z`);
  const weekday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - weekday + 3);
  const year = date.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(year, 0, 4));
  const firstWeekday = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstWeekday + 3);
  const week =
    1 +
    Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** Site-local bucket of a period: its stored operational date and shift label, never UTC (AN03). */
export function bucketOf(state: PeriodState, groupBy: TrendGroup): string {
  const date = state.period.localDate;
  if (groupBy === 'shift') return `${date} ${state.period.shiftName ?? ''}`;
  if (groupBy === 'week') return isoWeek(date);
  if (groupBy === 'month') return date.slice(0, 7);
  return date;
}

function bucketFor(
  buckets: Map<string, Bucket>,
  key: string,
  uom: string | null,
): Bucket {
  const id = `${key}|${uom ?? ''}`;
  const found = buckets.get(id);
  if (found) return found;
  const created: Bucket = {
    key,
    uom,
    unaccounted: ZERO,
    overAccounted: ZERO,
    overproduction: ZERO,
    periods: new Set(),
    included: 0,
    excluded: 0,
  };
  buckets.set(id, created);
  return created;
}

function addPeriod(
  buckets: Map<string, Bucket>,
  state: PeriodState,
  key: string,
): void {
  for (const slice of state.reconciliation?.slices ?? []) {
    const bucket = bucketFor(buckets, key, slice.uom);
    bucket.periods.add(state.period.id);
    if (
      slice.target === null ||
      slice.actual === null ||
      slice.gap === null ||
      slice.residual === null
    ) {
      bucket.excluded += 1;
      continue;
    }
    bucket.included += 1;
    const steps = planSteps(slice, new Map());
    bucket.unaccounted = bucket.unaccounted.minus(
      steps.get('unaccounted') ?? ZERO,
    );
    bucket.overAccounted = bucket.overAccounted.plus(
      steps.get('over_accounted') ?? ZERO,
    );
    bucket.overproduction = bucket.overproduction.plus(
      steps.get('overproduction') ?? ZERO,
    );
  }
}

const figure = (bucket: Bucket, value: Dec) =>
  bucket.included === 0 ? null : formatDec(value);

/** Running buckets of a reconciliation trend; fed page by page (`addTrendStates`), read by `trendView`. */
export interface TrendAccumulator {
  buckets: Map<string, Bucket>;
  runIds: Set<string>;
}

export const trendAccumulator = (): TrendAccumulator => ({
  buckets: new Map(),
  runIds: new Set(),
});

export function addTrendStates(
  acc: TrendAccumulator,
  states: readonly PeriodState[],
  groupBy: TrendGroup,
): void {
  for (const state of states) {
    if (state.run) acc.runIds.add(state.run.id);
    const key = bucketOf(state, groupBy);
    if (!state.run || !state.reconciliation) {
      bucketFor(acc.buckets, key, null).excluded += 1;
      continue;
    }
    addPeriod(acc.buckets, state, key);
  }
}

/**
 * Unaccounted, over-accounted and overproduction quantities per site-local bucket (plan 3.6, AN02): the
 * plan-ledger residual steps of the scope waterfall (same slices, same decisions, same arithmetic), so the
 * buckets of a window add up to the waterfall's bars. Units of measure are kept apart, never summed.
 */
export function trendView(
  acc: TrendAccumulator,
  groupBy: TrendGroup,
): ReconciliationTrendView {
  const ordered = [...acc.buckets.values()].sort(
    (a, b) =>
      a.key.localeCompare(b.key) || (a.uom ?? '').localeCompare(b.uom ?? ''),
  );
  return {
    groupBy,
    ledger: 'plan',
    buckets: ordered.map((b) => ({
      key: b.key,
      uom: b.uom,
      unaccounted: figure(b, b.unaccounted),
      overAccounted: figure(b, b.overAccounted),
      overproduction: figure(b, b.overproduction),
      periods: b.periods.size,
      excludedSlices: b.excluded,
    })),
    calculationRunIds: [...acc.runIds].sort(),
  };
}
