import { Link } from 'react-router-dom';
import type { MonthCloseStateView } from '@/api/v2/types/reconciliation';
import { CLOSE_STATE_LABELS } from '@/features/month-close/model/close-labels';
import { monthLabelOf } from '@/features/month-close/model/month-label';
import { useCalendarPreference } from '@/lib/dates';
import { monthLockKind } from '../model/month-lock';

/** The month a period belongs to as words (`October 2026`, `Mehr 1405`), or "of this period" without a key. */
function useMonthLabel(monthKey: string | null): string {
  const { calendar, digits } = useCalendarPreference();
  return monthKey ? monthLabelOf(monthKey, calendar, digits) : 'of this period';
}

/**
 * UX D-7: the period's month is locked or closing (server month close state), with what that means for a
 * correction and a link to the month close page. Nothing while the month is open.
 */
export function MonthLockBanner({ monthClose }: { monthClose: MonthCloseStateView | undefined }) {
  const kind = monthLockKind(monthClose);
  const label = useMonthLabel(monthClose?.monthKey ?? null);
  if (!kind || !monthClose) return null;
  const href = monthClose.monthKey ? `/month-close?month=${encodeURIComponent(monthClose.monthKey)}` : '/month-close';
  return (
    <p role="status" className="rounded-md border border-warning/40 p-3 text-sm" data-testid="month-lock-banner" data-state={monthClose.state}>
      <span className="font-medium">{kind === 'locked' ? `Month ${label} is locked` : `Month ${label} is closing (${CLOSE_STATE_LABELS[monthClose.state].toLowerCase()})`}</span>
      {' — '}
      {kind === 'locked'
        ? 'approved figures change only through a correction proposal.'
        : 'corrections of approved periods are paused until the month is locked or reopened.'}{' '}
      <Link className="underline" to={href}>
        Month close
      </Link>
    </p>
  );
}
