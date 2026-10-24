import { Dec, formatDec, ZERO } from '../../domain/actuals/decimal';
import { planSteps } from '../../domain/reconciliation/waterfall';
import { sumOf } from '../../domain/accounting/claims';
import { SliceReconciliation } from '../../domain/reconciliation/reconciliation.types';
import { PeriodState } from '../period-overview/period-states';

/** One site-local bucket (or the window total) and unit of measure of the reconciliation trend (decimal strings, ≥ 0). */
export interface ReconciliationTrendBucketView {
  /** the site-local bucket, or 'total' for the window total of a unit of measure */
  key: string;
  uom: string | null;
  /**
   * Σ positive residuals after decisions (the waterfall's "Unaccounted residual", as a magnitude); every
   * figure is null when no slice of the bucket is computable (never a fabricated 0)
   */
  unaccounted: string | null;
  /** Σ negative residuals (the waterfall's "Over-accounted", as a magnitude) */
  overAccounted: string | null;
  /** Σ output above target (the waterfall's "Overproduction") */
  overproduction: string | null;
  /** Σ target of the computable slices */
  plan: string | null;
  /** Σ actual output of the computable slices */
  actual: string | null;
  /** Σ shortfall (target − actual where output fell short) */
  shortfall: string | null;
  /**
   * SME R7: loss nobody explained — the positive residual, tolerance adjustments and classified Unaccounted
   * lines (a label is not proof)
   */
  unexplained: string | null;
  /** explained loss: shortfall − unexplained, floored at 0 */
  explained: string | null;
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

/** Running figures of one bucket and unit of measure. */
export interface Bucket {
  key: string;
  uom: string | null;
  unaccounted: Dec;
  overAccounted: Dec;
  overproduction: Dec;
  plan: Dec;
  actual: Dec;
  shortfall: Dec;
  unexplained: Dec;
  /** formatted targets of the included periods ('' = none) */
  targets: Set<string>;
  periods: Set<string>;
  included: number;
  excluded: number;
}

/** The bucket of `key` and `uom` in `buckets`, created empty on first use. */
export function bucketFor(
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
    actual: ZERO,
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
  bucket.actual = bucket.actual.plus(slice.actual ?? ZERO);
  bucket.shortfall = bucket.shortfall.plus(positive(slice.gap));
  bucket.unexplained = bucket.unexplained.plus(unexplainedOf(state, slice));
  const target = state.rule?.unaccountedTarget;
  bucket.targets.add(target ? formatDec(target) : '');
}

const computable = (slice: SliceReconciliation) =>
  slice.target !== null &&
  slice.actual !== null &&
  slice.gap !== null &&
  slice.residual !== null;

/** Adds one slice of a period to a bucket: counted as excluded when a figure is unknown. */
export function addSlice(
  bucket: Bucket,
  state: PeriodState,
  slice: SliceReconciliation,
): void {
  bucket.periods.add(state.period.id);
  if (!computable(slice)) {
    bucket.excluded += 1;
    return;
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

/** The view of a bucket: ratios and target computed from its own sums, never averaged. */
export function bucketView(b: Bucket): ReconciliationTrendBucketView {
  return {
    key: b.key,
    uom: b.uom,
    unaccounted: figure(b, b.unaccounted),
    overAccounted: figure(b, b.overAccounted),
    overproduction: figure(b, b.overproduction),
    plan: figure(b, b.plan),
    actual: figure(b, b.actual),
    shortfall: figure(b, b.shortfall),
    unexplained: figure(b, b.unexplained),
    explained: figure(b, positive(b.shortfall.minus(b.unexplained))),
    unexplainedOfPlan: ratio(b, b.unexplained, b.plan),
    unexplainedOfShortfall: ratio(b, b.unexplained, b.shortfall),
    ...targetFigures(b),
    periods: b.periods.size,
    excludedSlices: b.excluded,
  };
}

/** Buckets in key, then unit-of-measure order. */
export const byKeyAndUom = (a: Bucket, b: Bucket) =>
  a.key.localeCompare(b.key) || (a.uom ?? '').localeCompare(b.uom ?? '');
