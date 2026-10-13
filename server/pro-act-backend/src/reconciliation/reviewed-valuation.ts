import { Dec, formatDec } from '../domain/actuals/decimal';
import {
  reconciledValuation,
  ReconciledCandidate,
  ReconciledLine,
  ReconciledValuation,
} from '../domain/valuation/reconciled-valuation';
import { ValuationContext } from '../domain/valuation/valuation.types';
import { loadLineValuation } from '../domain/valuation/valuation-snapshot';
import { ValuationTotal } from '../domain/valuation/valuation-totals';
import { decOf, RevisionState } from './revision-state';

/** Lines with a quantity of their own (decisions on candidates are valued on the candidate). */
const OWN_QUANTITY_ACTIONS = new Set(['manual', 'replace', 'tolerance']);

export interface ReviewedAmount {
  currency: string;
  amount: string | null;
  reason: string | null;
  fxRateIds: string[];
}

export interface ReviewedLineValuation {
  source: 'candidate' | 'line';
  id: string;
  sliceId: string;
  kind: string;
  quantity: string;
  views: Array<{
    view: string;
    status: string;
    reason: string | null;
    rateVersionIds: string[];
    amounts: ReviewedAmount[];
  }>;
}

export interface ReviewedValueTotal {
  sliceId: string;
  view: string;
  currency: string;
  amount: string | null;
  nativeAmount: string;
  status: string;
  reasons: string[];
  unvaluedQuantity: string;
  unvaluedSeconds: string;
  valuedLines: number;
  unvaluedLines: number;
  fxMissingLines: number;
  fxRateIds: string[];
}

/** The valuation part of the reviewed content (and of the approval snapshot). */
export interface ReviewedValuation {
  engineVersion: string;
  policyId: string | null;
  policyVersion: number | null;
  approved: boolean;
  defaultView: string;
  currencies: string[];
  timeBasisRule: string;
  fxPolicy: string;
  lines: ReviewedLineValuation[];
  slices: ReviewedValueTotal[];
}

function lineView(line: ReconciledLine): ReviewedLineValuation {
  return {
    source: line.source,
    id: line.id,
    sliceId: line.sliceId,
    kind: line.kind,
    quantity: formatDec(line.quantity),
    views: line.valuation.views.map((v) => ({
      view: v.view,
      status: v.status,
      reason: v.reason,
      rateVersionIds: [...new Set(v.components.map((c) => c.rateVersionId))],
      amounts: v.amounts.map((a) => ({
        currency: a.currency,
        amount: a.amount === null ? null : formatDec(a.amount),
        reason: a.reason,
        fxRateIds: a.fxRateIds,
      })),
    })),
  };
}

function totalView(total: ValuationTotal): ReviewedValueTotal {
  return {
    sliceId: total.sliceId,
    view: total.view,
    currency: total.currency,
    amount: total.amount === null ? null : formatDec(total.amount),
    nativeAmount: formatDec(total.nativeAmount),
    status: total.status,
    reasons: total.reasons,
    unvaluedQuantity: formatDec(total.unvaluedQuantity),
    unvaluedSeconds: formatDec(total.unvaluedSeconds),
    valuedLines: total.valuedLines,
    unvaluedLines: total.unvaluedLines,
    fxMissingLines: total.fxMissingLines,
    fxRateIds: total.fxRateIds,
  };
}

/** The run's plan-ledger candidates with their decided state and quantity. */
function candidatesOf(state: RevisionState): ReconciledCandidate[] {
  const outcomes = new Map(
    state.reconciliation.candidates.map((c) => [c.autoKey, c]),
  );
  return state.candidateLines.map((line) => {
    const outcome = outcomes.get(line.autoKey ?? line.id);
    const quantity = decOf(line.quantity) ?? new Dec(0);
    return {
      lossLineId: line.id,
      sliceId: line.sliceId,
      kind: line.kind,
      quantity,
      effectiveQuantity: outcome?.effectiveQuantity ?? quantity,
      state: outcome?.state ?? 'proposed',
      impactCodeId: line.impactCodeId,
      valuation: loadLineValuation(line.valuation),
    };
  });
}

/** The run's candidates with their decisions, the own-quantity lines and the slices, valued (2.6 × 2.8). */
function reconcile(
  state: RevisionState,
  context: ValuationContext,
): ReconciledValuation {
  return reconciledValuation({
    context,
    candidates: candidatesOf(state),
    lines: state.lines
      .filter((l) => OWN_QUANTITY_ACTIONS.has(l.action))
      .map((l) => ({
        id: l.id,
        sliceId: l.sliceId,
        kind: l.kind,
        quantity: decOf(l.quantity),
        uom: l.uom,
        impactCodeId: l.impactCodeId,
      })),
    slices: state.slices.map((s) => ({
      sliceId: s.id,
      profileId: s.profileId,
      start: s.windowFrom,
      uom:
        state.reconciliation.slices.find((r) => r.sliceId === s.id)?.uom ??
        null,
    })),
  });
}

/** VA-01b: the reconciled plan lines (decided candidates and own-quantity lines) with their valuation. */
export function approvedLedgerLines(state: RevisionState): ReconciledLine[] {
  const context = state.run?.valuationContext;
  return context ? reconcile(state, context).lines : [];
}

/**
 * VA-01: the reconciled plan-ledger valuation per slice, kind, view and currency, persisted at approval
 * (`approved_valuation_totals`) for the reports. Not part of the reviewed content, so submitted hashes
 * are unchanged; empty for runs calculated before plan 2.6 (no frozen context).
 */
export function approvedValueTotals(state: RevisionState): ValuationTotal[] {
  const context = state.run?.valuationContext;
  return context ? reconcile(state, context).totals : [];
}

/**
 * Valuation of the reviewed plan-ledger content (plan 2.6 × 2.8): candidates with their decided quantity
 * and manual lines, valued from the run's frozen context — so the approved figures are reproducible and
 * part of the content hash. null for runs calculated before plan 2.6 (no context): their content (and
 * hash) stays exactly as it was; such revisions are valued after a recompute.
 */
export function reviewedValuation(
  state: RevisionState,
): ReviewedValuation | null {
  const context = state.run?.valuationContext;
  if (!context) return null;
  const result = reconcile(state, context);
  const { policy } = context;
  return {
    engineVersion: context.engineVersion,
    policyId: policy.id,
    policyVersion: policy.version,
    approved: policy.approved,
    defaultView: policy.defaultBasis,
    currencies: policy.currencies,
    timeBasisRule: policy.timeBasisRule,
    fxPolicy: policy.fxPolicy,
    lines: result.lines.map(lineView),
    slices: result.slices.map(totalView),
  };
}
