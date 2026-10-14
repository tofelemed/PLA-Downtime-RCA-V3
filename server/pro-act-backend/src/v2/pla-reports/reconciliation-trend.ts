import { Dec, formatDec, ZERO } from '../../domain/actuals/decimal';
import { planSteps } from '../../domain/reconciliation/waterfall';
import { sumOf } from '../../domain/accounting/claims';
import { SliceReconciliation } from '../../domain/reconciliation/reconciliation.types';
import { PeriodState } from '../period-overview/period-states';
import { TrendGroup } from './pla-reports.dto';
import { WeekStart, weekKey } from '../../domain/calendar/week-start';

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
  /** Σ target of the computable slices */
  plan: string | null;
  /** Σ shortfall (target − actual where output fell short) */
  shortfall: string | null;
  /**
   * SME R7: loss nobody explained — the positive residual, tolerance adjustments and classified Unaccounted
   * lines (a label is not proof)
   */
  unexplained: string | null;
  /** unexplained / plan; null when the plan is 0 */
  unexplainedOfPlan: string | null;
  /** unexplained / shortfall; null (undefined) when nothing fell short */
  unexplainedOfShortfall: string | null;
  /** the tolerance policies' improvement target of unexplained / shortfall; null when none or they differ */
  unexplainedTarget: string | null;
  /** unexplained / shortfall is above that target; null when either is unknown */
  unexplainedAboveTarget: boolean | null;
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
  plan: Dec;
  shortfall: Dec;
  unexplained: Dec;
  /** formatted targets of the included periods ('' = none) */
  targets: Set<string>;
  periods: Set<string>;
  included: number;
  excluded: number;
}

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
    plan: ZERO,
    shortfall: ZERO,
    unexplained: ZERO,
    targets: new Set(),
    periods: new Set(),
    included: 0,
    excluded: 0,
  };
  buckets.set(id, created);
  return created;
}

const positive = (value: Dec | null) =>
  value && value.gt(ZERO) ? value : ZERO;

/** SME R7: what of a slice nobody explained (residual, tolerance adjustment, classified Unaccounted lines). */
function unexplainedOf(state: PeriodState, slice: SliceReconciliation): Dec {
  const labelled = state.lines
    .filter(
      (l) => l.sliceId === slice.sliceId && l.kind === 'unaccounted_classified',
    )
    .map((l) => positive(l.quantity));
  return sumOf([
    positive(slice.residual),
    positive(slice.toleranceAdjustment),
    ...labelled,
  ]);
}

function addFigures(
  bucket: Bucket,
  state: PeriodState,
  slice: SliceReconciliation,
): void {
  bucket.plan = bucket.plan.plus(slice.target ?? ZERO);
  bucket.shortfall = bucket.shortfall.plus(positive(slice.gap));
  bucket.unexplained = bucket.unexplained.plus(unexplainedOf(state, slice));
  const target = state.rule?.unaccountedTarget;
  bucket.targets.add(target ? formatDec(target) : '');
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
    addFigures(bucket, state, slice);
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

const ratio = (bucket: Bucket, value: Dec, base: Dec) =>
  bucket.included === 0 || base.isZero() ? null : formatDec(value.div(base));

function targetFigures(
  bucket: Bucket,
): Pick<
  ReconciliationTrendBucketView,
  'unexplainedTarget' | 'unexplainedAboveTarget'
> {
  const [only, ...others] = [...bucket.targets];
  const target = only && others.length === 0 ? only : null;
  const share = ratio(bucket, bucket.unexplained, bucket.shortfall);
  return {
    unexplainedTarget: target,
    unexplainedAboveTarget:
      target === null || share === null
        ? null
        : new Dec(share).gt(new Dec(target)),
  };
}

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
  bucket: { groupBy: TrendGroup; weekStart: WeekStart },
): void {
  for (const state of states) {
    if (state.run) acc.runIds.add(state.run.id);
    const key = bucketOf(state, bucket.groupBy, bucket.weekStart);
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
      plan: figure(b, b.plan),
      shortfall: figure(b, b.shortfall),
      unexplained: figure(b, b.unexplained),
      unexplainedOfPlan: ratio(b, b.unexplained, b.plan),
      unexplainedOfShortfall: ratio(b, b.unexplained, b.shortfall),
      ...targetFigures(b),
      periods: b.periods.size,
      excludedSlices: b.excluded,
    })),
    calculationRunIds: [...acc.runIds].sort(),
  };
}
