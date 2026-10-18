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
