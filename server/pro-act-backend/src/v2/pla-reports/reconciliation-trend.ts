import { PeriodState } from '../period-overview/period-states';
import { TrendGroup } from './pla-reports.dto';
import { WeekStart, weekKey } from '../../domain/calendar/week-start';
import {
  addSlice,
  Bucket,
  bucketFor,
  bucketView,
  byKeyAndUom,
  ReconciliationTrendBucketView,
} from './reconciliation-trend-bucket';

export type { ReconciliationTrendBucketView } from './reconciliation-trend-bucket';

export interface ReconciliationTrendView {
  groupBy: TrendGroup;
  ledger: 'plan';
  buckets: ReconciliationTrendBucketView[];
  /**
   * The window total per unit of measure (`key: 'total'`): the same figures over every bucket, ratios and
   * target computed from the totals (never averaged); units of measure are never summed together
   */
  totals: ReconciliationTrendBucketView[];
  calculationRunIds: string[];
}

/** Key of the window-total rows. */
export const TOTAL_KEY = 'total';

/**
 * Site-local bucket of a period: its stored operational date and shift label, never UTC (AN03); weeks
 * start on the plant's week start (DT-10).
 */
export function bucketOf(
  state: PeriodState,
  groupBy: TrendGroup,
  weekStart: WeekStart = 'monday',
): string {
  const date = state.period.localDate;
  if (groupBy === 'shift') return `${date} ${state.period.shiftName ?? ''}`;
  if (groupBy === 'week') return weekKey(date, weekStart);
  if (groupBy === 'month') return date.slice(0, 7);
  return date;
}

/** Running buckets and window totals of a reconciliation trend; fed page by page (`addTrendStates`), read by `trendView`. */
export interface TrendAccumulator {
  buckets: Map<string, Bucket>;
  totals: Map<string, Bucket>;
  runIds: Set<string>;
}

export const trendAccumulator = (): TrendAccumulator => ({
  buckets: new Map(),
  totals: new Map(),
  runIds: new Set(),
});

/** Each slice feeds its bucket and the window total of its unit of measure, once. */
function addPeriod(
  acc: TrendAccumulator,
  state: PeriodState,
  key: string,
): void {
  for (const slice of state.reconciliation?.slices ?? []) {
    addSlice(bucketFor(acc.buckets, key, slice.uom), state, slice);
    addSlice(bucketFor(acc.totals, TOTAL_KEY, slice.uom), state, slice);
  }
}

export function addTrendStates(
  acc: TrendAccumulator,
  states: readonly PeriodState[],
  bucket: { groupBy: TrendGroup; weekStart: WeekStart },
): void {
  for (const state of states) {
    if (state.run) acc.runIds.add(state.run.id);
    const key = bucketOf(state, bucket.groupBy, bucket.weekStart);
    if (!state.run || !state.reconciliation) {
      bucketFor(acc.buckets, key, null).excluded += 1;
      bucketFor(acc.totals, TOTAL_KEY, null).excluded += 1;
      continue;
    }
    addPeriod(acc, state, key);
  }
}

/**
 * Unaccounted, over-accounted and overproduction quantities per site-local bucket (plan 3.6, AN02): the
 * plan-ledger residual steps of the scope waterfall (same slices, same decisions, same arithmetic), so the
 * buckets of a window add up to the waterfall's bars. Plan, actual, shortfall, explained and unexplained loss
 * per bucket and per window total. Units of measure are kept apart, never summed.
 */
export function trendView(
  acc: TrendAccumulator,
  groupBy: TrendGroup,
): ReconciliationTrendView {
  return {
    groupBy,
    ledger: 'plan',
    buckets: [...acc.buckets.values()].sort(byKeyAndUom).map(bucketView),
    totals: [...acc.totals.values()].sort(byKeyAndUom).map(bucketView),
    calculationRunIds: [...acc.runIds].sort(),
  };
}
