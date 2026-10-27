import { Dec, ZERO } from '../actuals/decimal';
import { sumOf } from '../accounting/claims';
import { MEMO_KINDS } from '../accounting/accounting.types';
import { planTotals } from '../accounting/plan-totals';
import {
  Candidate,
  CANDIDATE_ACTIONS,
  CandidateOutcome,
  CandidateState,
  DecisionLine,
  Reconciliation,
  SliceBasis,
  SliceReconciliation,
  ToleranceRule,
} from './reconciliation.types';
import { toleranceFor } from './tolerance';

export interface ReconcileInput {
  candidates: readonly Candidate[];
  lines: readonly DecisionLine[];
  slices: readonly SliceBasis[];
  rule: ToleranceRule;
}

/** Run flags that describe the automatic candidates only; the reconciliation recomputes them. */
const RUN_ONLY_FLAGS = new Set([
  'unaccounted',
  'over_accounted',
  'overproduction',
  'conflict',
  'bridge_required',
]);

const STATE_OF: Readonly<Record<string, CandidateState>> = {
  accept: 'accepted',
  adjust: 'adjusted',
  replace: 'replaced',
  reject: 'rejected',
};

function outcomeOf(
  candidate: Candidate,
  decision: DecisionLine | undefined,
): CandidateOutcome {
  const state = decision ? STATE_OF[decision.action] : 'proposed';
  let effective = candidate.quantity;
  if (state === 'adjusted') effective = decision?.quantity ?? ZERO;
  if (state === 'replaced' || state === 'rejected') effective = ZERO;
  return {
    autoKey: candidate.autoKey,
    sliceId: candidate.sliceId,
    state,
    effectiveQuantity: effective,
  };
}

/** baseline_changed: the candidate's quantity moved since the save; candidate_missing: it is gone. */
function flagsOf(
  line: DecisionLine,
  candidates: ReadonlyMap<string, Candidate>,
): string[] {
  if (!CANDIDATE_ACTIONS.has(line.action)) return [];
  const candidate = line.autoKey ? candidates.get(line.autoKey) : undefined;
  if (!candidate) return ['candidate_missing'];
  if (line.baseQuantity && !candidate.quantity.eq(line.baseQuantity)) {
    return ['baseline_changed'];
  }
  return [];
}

/**
 * Quantity a line adds itself (manual lines, replacements of a candidate still present). A reversal (SME
 * R9) corrects an earlier period and adds nothing here, so it can never balance this period.
 */
export function ownQuantity(
  line: DecisionLine,
  candidates: ReadonlyMap<string, Candidate>,
): Dec {
  if (line.kind && MEMO_KINDS.has(line.kind)) return ZERO;
  if (line.action === 'manual') return line.quantity ?? ZERO;
  if (line.action === 'replace' && line.autoKey && candidates.has(line.autoKey))
    return line.quantity ?? ZERO;
  return ZERO;
}

type SliceBase = Omit<
  SliceReconciliation,
  | 'gap'
  | 'unadjustedResidual'
  | 'residual'
  | 'overAccounted'
  | 'overproduction'
  | 'flags'
>;

/** Plan identity of a slice whose target and actual are known. */
function withPlan(
  base: SliceBase,
  flags: string[],
  epsilon: Dec,
): SliceReconciliation {
  const plan = planTotals({
    target: base.target as Dec,
    actual: base.actual,
    attributed: base.attributed.plus(base.toleranceAdjustment),
    epsilon,
  });
  const labels = base.toleranceAdjustment.isZero()
    ? []
    : ['tolerance_adjusted'];
  return {
    ...base,
    gap: plan.gap,
    unadjustedResidual: plan.gap ? plan.gap.minus(base.attributed) : null,
    residual: plan.residual,
    overAccounted: plan.overAccounted,
    overproduction: plan.overproduction,
    flags: [...new Set([...flags, ...labels, ...plan.flags])],
  };
}

/** Σ candidates in force + lines adding their own quantity − the declared recovery of the slice. */
function attributedOf(
  basis: SliceBasis,
  lines: readonly DecisionLine[],
  outcomes: readonly CandidateOutcome[],
  candidates: ReadonlyMap<string, Candidate>,
): Dec {
  return sumOf([
    ...outcomes
      .filter((o) => o.sliceId === basis.sliceId)
      .map((o) => o.effectiveQuantity),
    ...lines.map((line) => ownQuantity(line, candidates)),
  ]).minus(basis.declaredGain ?? ZERO);
}

function sliceTotals(
  basis: SliceBasis,
  input: ReconcileInput,
  outcomes: readonly CandidateOutcome[],
  candidates: ReadonlyMap<string, Candidate>,
): SliceReconciliation {
  const lines = input.lines.filter((l) => l.sliceId === basis.sliceId);
  const base: SliceBase = {
    sliceId: basis.sliceId,
    uom: basis.uom,
    target: basis.target,
    actual: basis.actual,
    attributed: attributedOf(basis, lines, outcomes, candidates),
    declaredGain: basis.declaredGain ?? ZERO,
    toleranceAdjustment: sumOf(
      lines
        .filter((l) => l.action === 'tolerance')
        .map((l) => l.quantity ?? ZERO),
    ),
    tolerance: toleranceFor(input.rule, basis.target),
  };
  const flags = basis.flags.filter((flag) => !RUN_ONLY_FLAGS.has(flag));
  if (basis.target !== null && basis.actual !== null) {
    return withPlan(base, flags, input.rule.epsilon);
  }
  const missing = basis.actual === null ? ['actuals_missing'] : [];
  return {
    ...base,
    gap: null,
    unadjustedResidual: null,
    residual: null,
    overAccounted: null,
    overproduction: null,
    flags: [...new Set([...flags, ...missing])],
  };
}

/**
 * The reconciliation of a revision (ACC07–ACC09): automatic candidates of the current run with the saved
 * decisions applied (accept keeps the candidate, adjust replaces its quantity, replace and reject take it
 * out — the replacement is a line of its own), manual lines added, a declared run's recovery shares
 * (`SliceBasis.declaredGain`, Task 13) taken off, tolerance adjustments kept apart, and
 * per slice the plan identity `target − actual = attributed + tolerance adjustment + residual` with the
 * residual signed and never clamped. Decisions whose candidate vanished or changed are flagged and never
 * counted twice. Pure and deterministic.
 */
export function reconcile(input: ReconcileInput): Reconciliation {
  const candidates = new Map(input.candidates.map((c) => [c.autoKey, c]));
  const decisions = new Map(
    input.lines
      .filter((line) => CANDIDATE_ACTIONS.has(line.action) && line.autoKey)
      .map((line) => [line.autoKey as string, line]),
  );
  const outcomes = input.candidates.map((c) =>
    outcomeOf(c, decisions.get(c.autoKey)),
  );
  return {
    candidates: outcomes,
    lineFlags: input.lines.map((line) => flagsOf(line, candidates)),
    slices: input.slices.map((basis) =>
      sliceTotals(basis, input, outcomes, candidates),
    ),
  };
}
