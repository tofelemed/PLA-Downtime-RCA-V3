import { UnprocessableEntityException } from '@nestjs/common';
import { Dec, formatDec, toDec, ZERO } from '../../domain/actuals/decimal';
import {
  addSteps,
  buildWaterfall,
  CAPACITY_STEP_KEYS,
  capacitySteps,
  PLAN_STEP_KEYS,
  planKindTotals,
  planSteps,
  StepTotals,
  WaterfallLedger,
} from '../../domain/reconciliation/waterfall';
import { PeriodState, RevisionSelector } from './period-states';

const LABELS: Readonly<Record<string, string>> = {
  target: 'Plan target',
  capacity: 'Capacity at sustained rate',
  actual: 'Actual (good)',
  schedule_exclusion: 'Schedule exclusion',
  availability: 'Availability loss',
  performance: 'Performance loss',
  quality: 'Quality loss',
  bridge: 'Bridge',
  unaccounted_classified: 'Unaccounted (classified)',
  gain: 'Gain',
  tolerance_adjustment: 'Tolerance adjustment',
  unaccounted: 'Unaccounted residual',
  over_accounted: 'Over-accounted',
  overproduction: 'Overproduction',
  conflict_offset: 'Attributed loss on an overproducing period (conflict)',
  residual: 'Residual',
};

export interface WaterfallBarV2View {
  key: string;
  label: string;
  kind: 'total' | 'step';
  /** signed change of the running total, decimal string (null for totals) */
  delta: string | null;
  start: string;
  end: string;
}

/** A ledger waterfall that closes to actual (plan 3.5): bars with start / end, never summed by the client. */
export interface WaterfallV2View {
  ledger: WaterfallLedger;
  view: RevisionSelector;
  uom: string | null;
  periodIds: string[];
  calculationRunIds: string[];
  bars: WaterfallBarV2View[];
  opening: string | null;
  closing: string | null;
  /** opening + Σ steps = closing exactly */
  closes: boolean;
  /** true unless every included period shows an approved revision */
  isProvisional: boolean;
  /** slices left out because a figure is unknown (reason = the ledger flag) */
  excluded: Array<{ periodId: string; sliceId: string | null; reason: string }>;
}

interface Accumulator {
  opening: Dec;
  closing: Dec;
  steps: StepTotals;
  uoms: Set<string | null>;
  excluded: WaterfallV2View['excluded'];
  included: number;
}

function planInto(acc: Accumulator, state: PeriodState): void {
  for (const slice of state.reconciliation?.slices ?? []) {
    if (
      slice.target === null ||
      slice.actual === null ||
      slice.gap === null ||
      slice.residual === null
    ) {
      const reason =
        slice.flags.find((f) => f !== 'tolerance_adjusted') ?? 'not_computable';
      acc.excluded.push({
        periodId: state.period.id,
        sliceId: slice.sliceId,
        reason,
      });
      continue;
    }
    const outcomes = state.reconciliation?.candidates ?? [];
    addSteps(
      acc.steps,
      planSteps(
        slice,
        planKindTotals(slice.sliceId, state.candidates, outcomes, state.lines),
      ),
    );
    acc.opening = acc.opening.plus(slice.target);
    acc.closing = acc.closing.plus(slice.actual);
    acc.uoms.add(slice.uom);
    acc.included += 1;
  }
}

function capacityInto(acc: Accumulator, state: PeriodState): void {
  for (const totals of state.totals.filter((t) => t.ledger === 'capacity')) {
    const capacity = toDec(totals.capacityQty);
    const good = toDec(totals.goodQty);
    const residual = toDec(totals.residualQty);
    if (capacity === null || good === null || residual === null) {
      acc.excluded.push({
        periodId: state.period.id,
        sliceId: totals.sliceId,
        reason: totals.flags[0] ?? 'not_computable',
      });
      continue;
    }
    addSteps(
      acc.steps,
      capacitySteps({
        capacity,
        exclusion: toDec(totals.exclusionQty),
        availability: toDec(totals.availabilityQty),
        performance: toDec(totals.performanceQty),
        quality: toDec(totals.qualityQty),
        gain: toDec(totals.gainQty),
        residual,
      }),
    );
    acc.opening = acc.opening.plus(capacity);
    acc.closing = acc.closing.plus(good);
    acc.uoms.add(totals.uom);
    acc.included += 1;
  }
}

/** Sums the periods' ledger into one waterfall; units of measure are never mixed (422 UOM_MIXED). */
export function waterfallOf(
  states: readonly PeriodState[],
  ledger: WaterfallLedger,
  view: RevisionSelector,
): WaterfallV2View {
  const acc: Accumulator = {
    opening: ZERO,
    closing: ZERO,
    steps: new Map(),
    uoms: new Set(),
    excluded: [],
    included: 0,
  };
  for (const state of states) {
    if (!state.run) {
      acc.excluded.push({
        periodId: state.period.id,
        sliceId: null,
        reason: 'no_calculation_run',
      });
      continue;
    }
    if (ledger === 'plan') planInto(acc, state);
    else capacityInto(acc, state);
  }
  if (acc.uoms.size > 1) {
    throw new UnprocessableEntityException({
      code: 'UOM_MIXED',
      message:
        'the periods are measured in different units; choose periods of one unit of measure',
    });
  }
  const base = {
    ledger,
    view,
    uom: acc.uoms.size === 1 ? [...acc.uoms][0] : null,
    periodIds: states.map((s) => s.period.id),
    calculationRunIds: states.flatMap((s) => (s.run ? [s.run.id] : [])),
    isProvisional: states.some((s) => s.revision?.lifecycle !== 'approved'),
    excluded: acc.excluded,
  };
  if (acc.included === 0)
    return { ...base, bars: [], opening: null, closing: null, closes: false };
  const openingKey = ledger === 'plan' ? 'target' : 'capacity';
  const order = ledger === 'plan' ? PLAN_STEP_KEYS : CAPACITY_STEP_KEYS;
  const built = buildWaterfall(
    { key: openingKey, value: acc.opening },
    acc.steps,
    order,
    { key: 'actual', value: acc.closing },
  );
  return {
    ...base,
    bars: built.bars.map((bar) => ({
      key: bar.key,
      label: LABELS[bar.key] ?? bar.key,
      kind: bar.kind,
      delta: bar.delta === null ? null : formatDec(bar.delta),
      start: formatDec(bar.start),
      end: formatDec(bar.end),
    })),
    opening: formatDec(built.opening),
    closing: formatDec(built.closing),
    closes: built.closes,
  };
}
