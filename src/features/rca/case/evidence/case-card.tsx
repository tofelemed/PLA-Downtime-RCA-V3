import { useId, type ReactNode } from 'react';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { ReportLookContext, type ReportLook } from '@/features/ux-kit/report-look';
import { cn } from '@/lib/utils';

/** Case records, not period figures: no Provisional marker; a list's own empty message and its action stay. */
const CASE_LOOK: ReportLook = { provisional: false, ownEmpty: true };

export interface CaseCardProps {
  title: string;
  /** a count (or short count line) after the title, muted */
  count?: ReactNode;
  /** what the card means, behind the ⓘ next to the title */
  info?: ReactNode;
  /** at the right of the title */
  actions?: ReactNode;
  testId?: string;
  className?: string;
  children: ReactNode;
}

/**
 * One card of an RCA case sub-page (detail redesign 24 Oct 2026): `rounded-lg border bg-card p-4`, an h2
 * title with its count and ⓘ, actions on the right, and the shared report look for the tables inside.
 */
export function CaseCard({ title, count, info, actions, testId, className, children }: CaseCardProps) {
  const id = useId();
  return (
    <ReportLookContext.Provider value={CASE_LOOK}>
      <section aria-labelledby={id} className={cn('min-w-0 space-y-3 rounded-lg border bg-card p-4', className)} data-testid={testId}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <h2 id={id} className="text-base font-semibold text-heading">
              {title}
            </h2>
            {count !== undefined && (
              <span className="whitespace-nowrap text-sm text-muted-foreground" data-testid="card-count">
                {count}
              </span>
            )}
            {info && <KpiInfo label={title} text={info} />}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        {children}
      </section>
    </ReportLookContext.Provider>
  );
}
