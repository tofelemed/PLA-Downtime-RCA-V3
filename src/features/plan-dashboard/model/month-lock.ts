import type { MonthCloseStateView, ReconciliationView } from '@/api/v2/types/reconciliation';

export type MonthLockKind = 'locked' | 'closing';

/** The banner of the period's month (UX D-7): locked, closing (quantities closed / finance signed off) or none. */
export function monthLockKind(monthClose: MonthCloseStateView | undefined): MonthLockKind | null {
  if (!monthClose || monthClose.state === 'open') return null;
  return monthClose.state === 'locked' ? 'locked' : 'closing';
}

/**
 * Whether "Reopen for revision…" is offered: only while the server says the month allows a direct correction.
 * An older server without `monthClose` keeps the previous behaviour (the server still refuses when closed).
 */
export function allowsDirectRevision(view: Pick<ReconciliationView, 'monthClose'>): boolean {
  return (view.monthClose?.correctionPath ?? 'direct') === 'direct';
}

/**
 * The "Propose a correction" dialog text for the period's month and the user (QA re-test: never a closing /
 * locked-month or SuperAdmin sentence shown to a production accountant on an open month).
 */
export function correctionDialogText(monthClose: MonthCloseStateView | undefined, isSuperAdmin: boolean): string {
  const self = isSuperAdmin ? ' As SuperAdmin you may also decide your own proposal.' : '';
  const kind = monthLockKind(monthClose);
  const month = kind === 'locked' ? 'The month is locked: approved figures change only through a correction.' : kind === 'closing' ? 'The month is closing: approved figures change only through a correction.' : 'Describe what is wrong with the approved figures.';
  return `${month} Another approver accepts or dismisses it; an accepted correction opens a new revision and its restatement.${self}`;
}

/** An open month's approved period is corrected with "Reopen for revision…", not a proposal (the server answers 409 MONTH_OPEN). */
export function proposalPathOpen(view: Pick<ReconciliationView, 'monthClose'>): boolean {
  return view.monthClose?.state !== 'open';
}
