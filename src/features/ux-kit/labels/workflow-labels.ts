import type { QueryOf } from '@/api/v2/schema-types';
import type { GridWorkflowState, LedgerKind, ResidualState, RevisionSelector } from '@/api/v2/types/period-overview';
import type { CandidateState, DraftAction, ManualKind, RevisionLifecycle } from '@/api/v2/types/reconciliation';

/**
 * Labels of period accounting and workflow (plan 3.5): grid workflow, revision lifecycle, readiness,
 * residuals, loss lines and valuation status. Wording follows `plan-dashboard/model/display.ts`.
 */
export type ReadinessState = NonNullable<QueryOf<'/api/v2/production-periods', 'get'>['readiness']>[number];
export type ValuationStatus = 'valued' | 'unvalued' | 'mixed';
export type LossLineKind = ManualKind | 'tolerance_adjustment';

export const GRID_WORKFLOW_LABELS: Readonly<Record<GridWorkflowState, string>> = {
  none: 'Not calculated',
  draft: 'Draft',
  in_review: 'In review',
  stale: 'Stale (inputs changed)',
  approved: 'Approved',
};

export const REVISION_LIFECYCLE_LABELS: Readonly<Record<RevisionLifecycle, string>> = {
  draft: 'Draft',
  in_review: 'In review',
  approved: 'Approved',
  cancelled: 'Cancelled',
};

/** Display readiness only (WF01: not a workflow state). */
export const READINESS_LABELS: Readonly<Record<ReadinessState, string>> = {
  open: 'Open',
  complete_inputs: 'Inputs complete',
  reconciled: 'Reconciled',
};

export const RESIDUAL_LABELS: Readonly<Record<ResidualState, string>> = {
  not_computable: 'Not computable',
  balanced: 'Balanced',
  within_tolerance: 'Within tolerance',
  unaccounted: 'Unaccounted',
  over_accounted: 'Over-accounted',
  overproduction: 'Overproduction',
  conflict: 'Conflict (loss on overproduction)',
};

export const CANDIDATE_STATE_LABELS: Readonly<Record<CandidateState, string>> = {
  proposed: 'Proposed',
  accepted: 'Accepted',
  adjusted: 'Adjusted',
  replaced: 'Replaced',
  rejected: 'Rejected',
};

export const DRAFT_ACTION_LABELS: Readonly<Record<DraftAction, string>> = {
  accept: 'Accept',
  adjust: 'Adjust',
  replace: 'Replace',
  reject: 'Reject',
  manual: 'Manual line',
};

/** Loss line kind. */
export const LOSS_KIND_LABELS: Readonly<Record<LossLineKind, string>> = {
  availability: 'Availability',
  performance: 'Performance',
  quality: 'Quality',
  bridge: 'Bridge',
  gain: 'Gain',
  unaccounted_classified: 'Unaccounted (classified)',
  tolerance_adjustment: 'Tolerance adjustment',
  reversal: 'Reversal of an earlier entry',
};

export const LEDGER_LABELS: Readonly<Record<LedgerKind, string>> = {
  plan: 'Plan ledger',
  capacity: 'Capacity ledger',
};

export const REVISION_SELECTOR_LABELS: Readonly<Record<RevisionSelector, string>> = {
  current: 'Current revision',
  approved: 'Approved revision',
};

export const VALUATION_STATUS_LABELS: Readonly<Record<ValuationStatus, string>> = {
  valued: 'Valued',
  unvalued: 'Not valued',
  mixed: 'Partly valued',
};

/** Why an amount is not valued. */
export const VALUATION_REASON_LABELS: Readonly<Record<string, string>> = {
  not_valued: 'No valuation recorded',
  policy_unapproved: 'Valuation policy not approved by finance',
  fx_rate_missing: 'No approved exchange rate for the date',
  fx_rate_provisional: 'Converted with a provisional exchange rate (revalued when the final rate is approved)',
  rate_missing: 'No approved valuation rate',
  uom_mismatch: 'Rate unit differs from the loss unit',
};

/** Period workflow commands, as shown in the period history. */
export const WORKFLOW_ACTION_LABELS: Readonly<Record<string, string>> = {
  save_draft: 'Saved draft',
  submit: 'Submitted for review',
  approve: 'Approved',
  reject: 'Returned for changes',
  cancel: 'Cancelled',
  recompute: 'Recalculated',
  reopen: 'Reopened',
};
