import type { MonthCloseView } from '@/api/v2/types/month-close';

/** Why the quantities cannot be closed, from the server's counts and policy only (QA re-test N1). */
export type CloseBlocker = 'not-started' | 'missing-periods' | 'pending-periods' | 'uncertified-days' | 'open-proposals' | 'not-ended';

/** The blockers in the order a user resolves them; empty when the quantities may be closed. */
export function closeBlockersOf(view: MonthCloseView): CloseBlocker[] {
  const { prerequisites: p, policy } = view;
  if (p.monthStarted === false) return ['not-started'];
  const blockers: CloseBlocker[] = [];
  if (p.missingPeriodCount > 0) blockers.push('missing-periods');
  if (p.pendingCount > 0) blockers.push('pending-periods');
  if (policy.requireCertifiedDays && p.certifiedDays < p.days) blockers.push('uncertified-days');
  if (policy.blockOnOpenProposals && p.openProposalCount > 0) blockers.push('open-proposals');
  if (!p.monthEnded) blockers.push('not-ended');
  return blockers;
}

/** The headline above the counts: names the real state, never "need attention" when only time is missing. */
export function closeHeadline(view: MonthCloseView): string {
  if (view.state === 'locked') return 'Month locked.';
  const blockers = closeBlockersOf(view);
  if (blockers[0] === 'not-started') return 'This month has not started yet.';
  if (blockers.length === 0) return 'Prerequisites met.';
  if (blockers.length === 1 && blockers[0] === 'not-ended') return 'Prerequisites met — waiting for the month to end.';
  return 'Prerequisites need attention.';
}

/** Why "Close quantities…" is disabled; null when it is not. */
export function closeBlockedReason(view: MonthCloseView): string | null {
  const blockers = closeBlockersOf(view);
  if (blockers.length === 0) return null;
  if (blockers[0] === 'not-started') return 'This month has not started yet.';
  if (blockers.length === 1 && blockers[0] === 'not-ended') return 'Month not ended yet.';
  return 'Resolve the blocking prerequisites shown above before closing the quantities.';
}
