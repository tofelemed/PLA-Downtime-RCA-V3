import { Dec, ZERO } from '../actuals/decimal';
import {
  Candidate,
  CandidateOutcome,
  DecisionLine,
  SliceReconciliation,
} from './reconciliation.types';
import { ownQuantity } from './reconcile';

/**
 * Waterfall of a ledger (plan 3.5, §16.2 PlanWaterfallChart): an opening total (plan target or running
 * capacity), signed steps, and a closing total (actual = good). Every bar carries its start and end so the
 * chart never adds anything up; `closes` says whether opening + Σ steps equals the closing total exactly.
 */
export type WaterfallLedger = 'plan' | 'capacity';

export interface WaterfallBar {
  key: string;
  kind: 'total' | 'step';
  /** signed change of the running total (null for totals) */
  delta: Dec | null;
  start: Dec;
  end: Dec;
}

export interface Waterfall {
  bars: WaterfallBar[];
  opening: Dec;
  closing: Dec;
  closes: boolean;
}

/** Order of the plan-ledger steps; residual categories come last. */
export const PLAN_STEP_KEYS = [
  'availability',
  'performance',
  'quality',
  'transition_allowance',
  'transition_excess',
  'bridge',
  'unaccounted_classified',
  'gain',
  'tolerance_adjustment',
  'unaccounted',
  'over_accounted',
  'overproduction',
  'conflict_offset',
] as const;

export const CAPACITY_STEP_KEYS = [
  'schedule_exclusion',
  'availability',
  'performance',
  'quality',
  'gain',
  'residual',
] as const;

/** Signed steps of one slice or period, keyed by step; summed across slices by `addSteps`. */
export type StepTotals = Map<string, Dec>;

export function addSteps(into: StepTotals, from: StepTotals): void {
  for (const [key, value] of from) {
    into.set(key, (into.get(key) ?? ZERO).plus(value));
  }
}

/** Builds the bars: opening total, non-zero steps in `order`, closing total. */
export function buildWaterfall(
  opening: { key: string; value: Dec },
  steps: StepTotals,
  order: readonly string[],
  closing: { key: string; value: Dec },
): Waterfall {
  const bars: WaterfallBar[] = [
    {
      key: opening.key,
      kind: 'total',
      delta: null,
      start: ZERO,
      end: opening.value,
    },
  ];
  let running = opening.value;
  for (const key of order) {
    const delta = steps.get(key);
    if (!delta || delta.isZero()) continue;
    const end = running.plus(delta);
    bars.push({ key, kind: 'step', delta, start: running, end });
    running = end;
  }
  bars.push({
    key: closing.key,
    kind: 'total',
    delta: null,
    start: ZERO,
    end: closing.value,
  });
  return {
    bars,
    opening: opening.value,
    closing: closing.value,
    closes: running.eq(closing.value),
  };
}

/** Effective plan-ledger quantity per loss kind of one slice after the saved decisions (ACC07). */
export function planKindTotals(
  sliceId: string,
  candidates: readonly Candidate[],
  outcomes: readonly CandidateOutcome[],
  lines: readonly DecisionLine[],
): StepTotals {
  const byKey = new Map(candidates.map((c) => [c.autoKey, c]));
  const totals: StepTotals = new Map();
  const add = (kind: string, value: Dec) =>
    totals.set(kind, (totals.get(kind) ?? ZERO).plus(value));
  for (const outcome of outcomes.filter((o) => o.sliceId === sliceId)) {
    const candidate = byKey.get(outcome.autoKey);
    if (candidate) add(candidate.kind, outcome.effectiveQuantity);
  }
  for (const line of lines.filter((l) => l.sliceId === sliceId)) {
    if (line.action === 'tolerance') {
      add('tolerance_adjustment', line.quantity ?? ZERO);
    } else if (line.kind) {
      add(line.kind, ownQuantity(line, byKey));
    }
  }
  return totals;
}

/**
 * Plan-ledger steps of a computable slice: every kind lowers the running total by its quantity; the
 * signed residual is labelled unaccounted (> 0) or over-accounted (< 0), and on an overproducing slice it
 * is split into the overproduction (−gap) and the attributed loss it offsets (T17 conflict).
 */
export function planSteps(
  slice: SliceReconciliation,
  kinds: StepTotals,
): StepTotals {
  const steps: StepTotals = new Map();
  for (const [kind, quantity] of kinds) steps.set(kind, quantity.neg());
  const gap = slice.gap as Dec;
  const residual = slice.residual as Dec;
  const overproducing = (slice.overproduction ?? ZERO).gt(ZERO);
  if (overproducing) {
    steps.set('overproduction', gap.neg());
    steps.set('conflict_offset', residual.minus(gap).neg());
  } else if (residual.gt(ZERO)) {
    steps.set('unaccounted', residual.neg());
  } else if (residual.lt(ZERO)) {
    steps.set('over_accounted', residual.neg());
  }
  return steps;
}

export interface CapacityTotalsInput {
  capacity: Dec;
  exclusion: Dec | null;
  availability: Dec | null;
  performance: Dec | null;
  quality: Dec | null;
  gain: Dec | null;
  residual: Dec;
}

/** Capacity identity: capacity − exclusion − A − P − Q + gain − residual = good. */
export function capacitySteps(totals: CapacityTotalsInput): StepTotals {
  const minus = (value: Dec | null) => (value ?? ZERO).neg();
  return new Map([
    ['schedule_exclusion', minus(totals.exclusion)],
    ['availability', minus(totals.availability)],
    ['performance', minus(totals.performance)],
    ['quality', minus(totals.quality)],
    ['gain', totals.gain ?? ZERO],
    ['residual', totals.residual.neg()],
  ]);
}
