import { LossKind } from '../accounting/accounting.types';
import { Dec } from '../actuals/decimal';
import { CandidateState } from '../reconciliation/reconciliation.types';
import { unvaluedView } from './currency-amounts';
import { ManualHours } from './manual-line-hours';
import {
  reversalValuation,
  ReversedLineValue,
  valuesReversalsAtApprovedValue,
} from './reversal-valuation';
import { valueLine, viewsOf } from './value-line';
import {
  LineValuation,
  LineViewValuation,
  ValuationContext,
} from './valuation.types';
import {
  TotalsLine,
  valuationTotals,
  ValuationTotal,
} from './valuation-totals';

/** Kinds whose value is the period's loss value (gains, residuals and tolerance lines are shown apart). */
export const LOSS_VALUE_KINDS: ReadonlySet<LossKind> = new Set([
  'availability',
  'performance',
  'quality',
  'transition_allowance',
  'transition_excess',
  'unaccounted_classified',
  'bridge',
]);

export interface ReconciledCandidate {
  lossLineId: string;
  sliceId: string;
  kind: LossKind;
  quantity: Dec;
  effectiveQuantity: Dec;
  state: CandidateState;
  impactCodeId: string | null;
  valuation: LineValuation | null;
}

/** A saved line with its own quantity (manual, replace, tolerance). */
export interface ReconciledOwnLine {
  id: string;
  sliceId: string;
  kind: LossKind | null;
  quantity: Dec | null;
  uom: string | null;
  impactCodeId: string | null;
  /** SME V4 (policy v3): verified hours of a manual downtime line, or why it has none */
  hours?: ManualHours;
  /** SME R9: the approved line a `reversal` line reverses with its approved value; null = not found */
  reversed?: ReversedLineValue | null;
}

export interface ReconciledSlice {
  sliceId: string;
  profileId: string | null;
  /** product of the slice (demand status, SME V3) */
  productId?: string | null;
  start: Date;
  uom: string | null;
}

export interface ReconciledLine {
  source: 'candidate' | 'line';
  id: string;
  sliceId: string;
  kind: LossKind;
  quantity: Dec;
  valuation: LineValuation;
}

export interface ReconciledValuation {
  lines: ReconciledLine[];
  /** per slice, view and currency over the loss-value kinds */
  slices: ValuationTotal[];
  /** per slice, kind, view and currency of the plan ledger — what reports read once approved (VA-01) */
  totals: ValuationTotal[];
}

function scaleView(view: LineViewValuation, ratio: Dec): LineViewValuation {
  return {
    ...view,
    components: view.components.map((c) => ({
      ...c,
      quantity: c.quantity ? c.quantity.mul(ratio) : null,
      seconds: c.seconds ? c.seconds.mul(ratio) : null,
      amount: c.amount.mul(ratio),
    })),
    amounts: view.amounts.map((a) => ({
      ...a,
      amount: a.amount ? a.amount.mul(ratio) : null,
    })),
  };
}

/** A decided candidate: its run valuation scaled by effective / proposed quantity (linear, exact). */
function candidateLine(candidate: ReconciledCandidate): ReconciledLine | null {
  if (!candidate.valuation) return null;
  const ratio = candidate.quantity.isZero()
    ? new Dec(0)
    : candidate.effectiveQuantity.div(candidate.quantity);
  return {
    source: 'candidate',
    id: candidate.lossLineId,
    sliceId: candidate.sliceId,
    kind: candidate.kind,
    quantity: candidate.effectiveQuantity,
    valuation: {
      ...candidate.valuation,
      seconds: candidate.valuation.seconds?.mul(ratio) ?? null,
      views: candidate.valuation.views.map((v) => scaleView(v, ratio)),
    },
  };
}

/** A manual line: valued from the run's frozen context at the slice start (no interval of its own). */
function ownLine(
  line: ReconciledOwnLine,
  slices: ReadonlyMap<string, ReconciledSlice>,
  context: ValuationContext,
): ReconciledLine | null {
  const slice = slices.get(line.sliceId);
  if (!slice || !line.kind || !line.quantity) return null;
  if (
    line.kind === 'reversal' &&
    valuesReversalsAtApprovedValue(context.engineVersion)
  ) {
    return reversalLine(line, line.quantity, slice, context);
  }
  const hours = line.hours;
  const valuation = valueLine(
    {
      kind: line.kind,
      quantity: line.quantity,
      uom: line.uom ?? slice.uom,
      start: slice.start,
      end: slice.start,
      seconds: hours && 'seconds' in hours ? hours.seconds : null,
      profileId: slice.profileId,
      impactCodeId: line.impactCodeId,
      ...(slice.productId === undefined ? {} : { productId: slice.productId }),
    },
    context,
  );
  if (hours && 'reason' in hours && hours.reason === 'hours_unverified') {
    const currencies = context.policy.currencies;
    valuation.views.push(
      unvaluedView('cost_per_hour', hours.reason, currencies),
    );
  }
  return {
    source: 'line',
    id: line.id,
    sliceId: line.sliceId,
    kind: line.kind,
    quantity: line.quantity,
    valuation,
  };
}

/** SME R9 (2.8.1): a reversal carries the reversed line's approved value, opposite sign, never re-priced. */
function reversalLine(
  line: ReconciledOwnLine,
  quantity: Dec,
  slice: ReconciledSlice,
  context: ValuationContext,
): ReconciledLine {
  const fallback = {
    views: viewsOf(
      {
        kind: 'reversal',
        quantity,
        uom: line.uom ?? slice.uom,
        start: slice.start,
        end: slice.start,
        seconds: null,
        profileId: slice.profileId,
        impactCodeId: line.impactCodeId,
      },
      context.policy,
    ),
    currencies: context.policy.currencies,
    date: slice.start,
  };
  return {
    source: 'line',
    id: line.id,
    sliceId: line.sliceId,
    kind: 'reversal',
    quantity,
    valuation: reversalValuation(quantity, line.reversed ?? null, fallback),
  };
}

function merge(parts: readonly ValuationTotal[]): ValuationTotal {
  const [first] = parts;
  const sum = (pick: (t: ValuationTotal) => Dec) =>
    parts.reduce((acc, t) => acc.plus(pick(t)), new Dec(0));
  const valued = parts.reduce((n, t) => n + t.valuedLines, 0);
  const unvalued = parts.reduce((n, t) => n + t.unvaluedLines, 0);
  const fxMissing = parts.reduce((n, t) => n + t.fxMissingLines, 0);
  const fxProvisional = parts.reduce((n, t) => n + t.fxProvisionalLines, 0);
  const status =
    valued === 0 ? 'unvalued' : unvalued + fxMissing === 0 ? 'valued' : 'mixed';
  return {
    ...first,
    kind: 'availability',
    amount:
      valued === 0 || fxMissing > 0 ? null : sum((t) => t.amount ?? new Dec(0)),
    nativeAmount: sum((t) => t.nativeAmount),
    valuedLines: valued,
    unvaluedLines: unvalued,
    fxMissingLines: fxMissing,
    fxProvisionalLines: fxProvisional,
    unvaluedQuantity: sum((t) => t.unvaluedQuantity),
    unvaluedSeconds: sum((t) => t.unvaluedSeconds),
    status,
    reasons: [...new Set(parts.flatMap((t) => t.reasons))].sort(),
    fxRateIds: [...new Set(parts.flatMap((t) => t.fxRateIds))].sort(),
  };
}

/** Per slice, view and currency over the loss-value kinds (kind of the merged row is not meaningful). */
export function sliceValueTotals(
  totals: readonly ValuationTotal[],
): ValuationTotal[] {
  const groups = new Map<string, ValuationTotal[]>();
  for (const total of totals.filter((t) => LOSS_VALUE_KINDS.has(t.kind))) {
    const key = [total.sliceId, total.view, total.currency].join('|');
    groups.set(key, [...(groups.get(key) ?? []), total]);
  }
  return [...groups.values()].map(merge);
}

/**
 * Valuation of the reconciled plan ledger a reviewer approves (plan 2.6 × 2.8): candidates carry their
 * run valuation scaled to the decided quantity (rejected / replaced → 0), manual and replacing lines are
 * valued from the same frozen context, so the result is reproducible from the run and the line set.
 */
export function reconciledValuation(input: {
  context: ValuationContext;
  candidates: readonly ReconciledCandidate[];
  lines: readonly ReconciledOwnLine[];
  slices: readonly ReconciledSlice[];
}): ReconciledValuation {
  const slices = new Map(input.slices.map((s) => [s.sliceId, s]));
  const lines = [
    ...input.candidates.map(candidateLine),
    ...input.lines.map((l) => ownLine(l, slices, input.context)),
  ].filter((l): l is ReconciledLine => l !== null);
  const impact = new Map([
    ...input.candidates.map((c) => [c.lossLineId, c.impactCodeId] as const),
    ...input.lines.map((l) => [l.id, l.impactCodeId] as const),
  ]);
  const totalsLines: TotalsLine[] = lines.map((l) => ({
    sliceId: l.sliceId,
    ledger: 'plan',
    kind: l.kind,
    uom: slices.get(l.sliceId)?.uom ?? null,
    quantity: l.quantity,
    impactCodeId: impact.get(l.id) ?? null,
    valuation: l.valuation,
  }));
  const totals = valuationTotals(totalsLines, input.context.policy);
  return { lines, slices: sliceValueTotals(totals), totals };
}
