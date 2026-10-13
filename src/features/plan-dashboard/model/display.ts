import type { CurrencyValueView, GridWorkflowState, ResidualState } from '@/api/v2/types/period-overview';
import type { CandidateState, ReconciliationView } from '@/api/v2/types/reconciliation';
import { formatCurrencyAmount } from '@/features/display-currency/money-format';
import { humanize } from '@/features/ux-kit/labels';

/** Labels and display rules of the Plan Dashboard (plan 3.5); no figure is derived here. */
export const WORKFLOW_LABELS: Record<GridWorkflowState, string> = {
  none: 'Not calculated',
  draft: 'Draft',
  in_review: 'In review',
  stale: 'Stale (inputs changed)',
  approved: 'Approved',
};

export const RESIDUAL_LABELS: Record<ResidualState, string> = {
  not_computable: 'Not computable',
  balanced: 'Balanced',
  within_tolerance: 'Within tolerance',
  unaccounted: 'Unaccounted',
  over_accounted: 'Over-accounted',
  overproduction: 'Overproduction',
  conflict: 'Conflict (loss on overproduction)',
};

/** Server flags of a slice or ledger (residual states, overrides that changed underneath). */
export const FLAG_LABELS: Readonly<Record<string, string>> = {
  unaccounted: 'Unaccounted',
  over_accounted: 'Over-accounted',
  overproduction: 'Overproduction',
  conflict: 'Loss on overproduction',
  within_tolerance: 'Within tolerance',
  balanced: 'Balanced',
  baseline_changed: 'Changed since the decision',
  not_computable: 'Not computable',
  no_target: 'No target',
  no_actuals: 'No actuals',
  claim_exceeds_component: 'Causes claim more than measured loss',
  planned_rate_scaled: 'Priced at the planned rate (target ÷ eligible time)',
  unexplained: 'Unexplained (no event or measurement supports it)',
};

/** Residual states that block submission (ACC10) and are shown in red. */
export const BLOCKING_RESIDUALS: ReadonlySet<ResidualState> = new Set(['unaccounted', 'over_accounted', 'conflict']);

export const CANDIDATE_STATE_LABELS: Record<CandidateState, string> = {
  proposed: 'Proposed',
  accepted: 'Accepted',
  adjusted: 'Adjusted',
  replaced: 'Replaced',
  rejected: 'Rejected',
};

export const KIND_LABELS: Record<string, string> = {
  availability: 'Availability',
  performance: 'Performance',
  quality: 'Quality',
  bridge: 'Bridge',
  gain: 'Gain',
  unaccounted_classified: 'Unaccounted (classified)',
  tolerance_adjustment: 'Tolerance adjustment',
};

/** Data quality of a period's actuals (server tokens). */
export const QUALITY_LABELS: Readonly<Record<string, string>> = {
  measured: 'Measured',
  estimated: 'Estimated',
  excluded: 'Excluded',
  missing: 'Missing',
  partial: 'Partly measured',
  complete: 'Complete',
  incomplete: 'Incomplete',
  provisional: 'Provisional',
};

/** `1,234.57 USD` from a decimal string, rounded for display only; null amounts say why (never 0). */
export function formatMoney(value: CurrencyValueView): string {
  if (value.amount === null) {
    const reason = value.reasons.includes('fx_rate_missing') ? 'FX rate missing' : value.reasons.includes('policy_unapproved') ? 'policy not approved' : 'not valued';
    return `— ${value.currency} (${reason})`;
  }
  return formatCurrencyAmount(value.amount, value.currency);
}

const VALUATION_REASON_LABELS: Record<string, string> = {
  policy_unapproved: 'Valuation policy not approved by finance',
  fx_rate_missing: 'No approved FX rate for the date',
  rate_missing: 'No approved valuation rate',
  uom_mismatch: 'Rate unit differs from the loss unit',
};

export function valuationReasonLabel(reason: string): string {
  return VALUATION_REASON_LABELS[reason] ?? humanize(reason);
}

export interface ActionGate {
  allowed: boolean;
  reason: string | null;
  code: string | null;
}

/** Approve / reject offered only for a submitted revision; the submitter is told why not (D06, T36). */
export function reviewGate(view: ReconciliationView, userId: string | null): ActionGate {
  const revision = view.revision;
  if (revision.lifecycle !== 'in_review') return { allowed: false, reason: 'Only a submitted revision can be reviewed.', code: null };
  if (userId && revision.submittedBy === userId) {
    return { allowed: false, reason: 'You submitted this revision: another manager approver must review it (separation of duties).', code: 'SEPARATION_OF_DUTIES' };
  }
  if (revision.isStale) {
    return { allowed: false, reason: 'Inputs changed after submission: recompute and resubmit.', code: 'STALE_SUBMISSION' };
  }
  return { allowed: true, reason: null, code: null };
}

/** Approve also needs independence from the content: not an author of any reviewed line (D06, RC-01). */
export function approveGate(view: ReconciliationView, userId: string | null): ActionGate {
  const review = reviewGate(view, userId);
  if (!review.allowed || !userId) return review;
  if (view.lines.some((line) => line.authorId === userId)) {
    return { allowed: false, reason: 'You wrote lines in this revision: another manager approver must approve it (separation of duties).', code: 'SEPARATION_OF_DUTIES' };
  }
  return review;
}

const SERVICE_LABELS: Readonly<Record<string, string>> = {
  'accounting-worker': 'the accounting service',
  'actuals-worker': 'the actuals service',
  worker: 'the background service',
};

/** Who did it: "you", the user's name (`nameOf` from the user directory) or the service, never an id. */
export function actorLabel(actorId: string | null, userId: string | null, nameOf: (id: string) => string, service?: string | null): string {
  if (!actorId) return service ? (SERVICE_LABELS[service] ?? 'an automatic service') : '—';
  if (actorId === userId) return 'you';
  return nameOf(actorId);
}

/** `"0.875"` → `"87.5 %"`: a ratio shown as a percentage by moving the decimal point (no float maths). */
export function formatRatioPercent(ratio: string | null): string {
  if (ratio === null) return '—';
  const match = /^(-?)(\d*)(?:\.(\d*))?$/.exec(ratio.trim());
  if (!match) return ratio;
  const [, sign, whole, fraction = ''] = match;
  const digits = `${whole}${fraction.padEnd(2, '0')}`;
  const cut = whole.length + 2;
  const integer = digits.slice(0, cut).replace(/^0+(?=\d)/, '') || '0';
  const rest = digits.slice(cut).replace(/0+$/, '');
  return `${sign}${integer}${rest ? `.${rest.slice(0, 1)}` : ''} %`;
}
