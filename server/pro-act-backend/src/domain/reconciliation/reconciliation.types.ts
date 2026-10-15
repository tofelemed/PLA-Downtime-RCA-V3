import { Dec } from '../actuals/decimal';
import { LossKind } from '../accounting/accounting.types';

/** What an editor may do with a line (ACC07); `tolerance` lines are written by submit only (ACC09). */
export const DRAFT_ACTIONS = [
  'accept',
  'adjust',
  'replace',
  'reject',
  'manual',
] as const;
export type DraftAction = (typeof DRAFT_ACTIONS)[number];

export const LINE_ACTIONS = [...DRAFT_ACTIONS, 'tolerance'] as const;
export type LineAction = (typeof LINE_ACTIONS)[number];

/** Decisions that refer to an automatic candidate by its `auto_key`. */
export const CANDIDATE_ACTIONS: ReadonlySet<LineAction> = new Set([
  'accept',
  'adjust',
  'replace',
  'reject',
]);

/** Kinds an editor may give a manual or replacing line (never residual, exclusion or tolerance). */
export const MANUAL_KINDS = [
  'availability',
  'performance',
  'quality',
  'bridge',
  'gain',
  'unaccounted_classified',
  'reversal',
] as const;
export type ManualKind = (typeof MANUAL_KINDS)[number];

/** Kinds that may be negative on a reconciliation line. */
export const SIGNED_LINE_KINDS: ReadonlySet<LossKind> = new Set([
  'bridge',
  'gain',
  'tolerance_adjustment',
  'reversal',
]);

/** An automatic plan-ledger candidate of the current calculation run (2.5 `loss_lines`, source auto). */
export interface Candidate {
  autoKey: string;
  sliceId: string;
  kind: LossKind;
  quantity: Dec;
}

/** A saved reconciliation line, reduced to what the arithmetic needs. */
export interface DecisionLine {
  action: LineAction;
  autoKey: string | null;
  sliceId: string;
  kind: LossKind | null;
  quantity: Dec | null;
  baseQuantity: Dec | null;
  /** a cause is known to be uncoded (distinct from a missing event) */
  missingCode: boolean;
}

/** Plan-ledger basis of a slice from the run's totals (target, actual = good); null = not computable. */
export interface SliceBasis {
  sliceId: string;
  uom: string | null;
  target: Dec | null;
  actual: Dec | null;
  flags: string[];
}

/** `reconciliation_tolerance` (D06, ACC09) as decimals. */
export interface ToleranceRule {
  mode: 'zero' | 'percent' | 'absolute';
  value: Dec;
  epsilon: Dec;
  allowUnaccountedClassification: boolean;
  /** SME R7: reporting target of unexplained loss / shortfall; absent = none */
  unaccountedTarget?: Dec;
}

export type CandidateState =
  | 'proposed'
  | 'accepted'
  | 'adjusted'
  | 'replaced'
  | 'rejected';

export interface CandidateOutcome {
  autoKey: string;
  sliceId: string;
  state: CandidateState;
  /** what the candidate contributes to the attributed loss (0 when rejected or replaced) */
  effectiveQuantity: Dec;
}

/** Per-slice reconciliation totals (ACC07/ACC09): the residual is signed and never clamped. */
export interface SliceReconciliation {
  sliceId: string;
  uom: string | null;
  target: Dec | null;
  actual: Dec | null;
  gap: Dec | null;
  /** Σ candidates in force + manual lines (tolerance adjustments excluded) */
  attributed: Dec;
  toleranceAdjustment: Dec;
  /** gap − attributed, before tolerance adjustments (always stored, ACC09) */
  unadjustedResidual: Dec | null;
  /** gap − attributed − tolerance adjustments */
  residual: Dec | null;
  overAccounted: Dec | null;
  overproduction: Dec | null;
  tolerance: Dec;
  flags: string[];
}

export interface Reconciliation {
  slices: SliceReconciliation[];
  candidates: CandidateOutcome[];
  /** flags per decision line, index-aligned with the input lines (baseline_changed, candidate_missing) */
  lineFlags: string[][];
}

/** A blocking finding of submission (ACC10) or of a draft save (§15.3). */
export interface WorkflowIssue {
  code: string;
  message: string;
  sliceId: string | null;
  line?: number;
  expectedRemainingAllocation?: string;
}
