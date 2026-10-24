import { useId, type ReactNode } from 'react';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { ReportLookContext, type ReportLook } from '@/features/ux-kit/report-look';
import { cn } from '@/lib/utils';

/** Case records are not period figures: no Provisional marker; lists keep their own empty messages. */
const CASE_LOOK: ReportLook = { provisional: false, ownEmpty: true };

export interface CaseCardProps {
  title: string;
  /** what the section means, behind the ⓘ next to the title */
  info?: ReactNode;
  /** at the right of the title row */
  actions?: ReactNode;
  /** DOM id (deep links such as `#rca-workflow`) */
  id?: string;
  testId?: string;
  className?: string;
  children: ReactNode;
}

/**
 * A section of an RCA case page (redesign 24 Oct 2026): card `rounded-lg border bg-card p-4`, h2 title with
 * its ⓘ, actions right, content in the shared compact report look.
 */
export function CaseCard({ title, info, actions, id, testId, className, children }: CaseCardProps) {
  const headingId = useId();
  return (
    <ReportLookContext.Provider value={CASE_LOOK}>
      <section id={id} aria-labelledby={headingId} className={cn('min-w-0 scroll-mt-24 space-y-3 rounded-lg border bg-card p-4', className)} data-testid={testId}>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <h2 id={headingId} className="text-base font-semibold text-heading">
              {title}
            </h2>
            {info && <KpiInfo label={title} text={info} />}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        {children}
      </section>
    </ReportLookContext.Provider>
  );
}
