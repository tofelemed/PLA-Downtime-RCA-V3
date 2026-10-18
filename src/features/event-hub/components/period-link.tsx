import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { periodPath } from '@/features/plan-dashboard/model/period-navigation';

export interface PeriodLinkProps {
  periodId: string;
  /** plan of the period's selected plan version; null = no plan, so no workspace to open (plain text) */
  planId: string | null | undefined;
  /** G-2(b): open the approved revision (`?view=approved`) instead of the current one */
  approved?: boolean;
  children: ReactNode;
  testId?: string;
}

/**
 * G-2: a period of an event as a link to its workspace (`/plans/:planId/periods/:periodId`), carrying this
 * page as the back target (`listSearch`) so Back returns to the event. Without a plan it stays text.
 */
export function PeriodLink({ periodId, planId, approved = false, children, testId = 'period-link' }: PeriodLinkProps) {
  const location = useLocation();
  if (!planId) return <span className="font-medium">{children}</span>;
  return (
    <Link
      to={`${periodPath(planId, periodId)}${approved ? '?view=approved' : ''}`}
      state={{ listSearch: `${location.pathname}${location.search}` }}
      className="font-medium text-primary underline-offset-2 hover:underline"
      data-testid={testId}
      data-period-id={periodId}
    >
      {children}
    </Link>
  );
}
