import { useId, type ReactNode } from 'react';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { ReportLookContext, type ReportLook } from '@/features/ux-kit/report-look';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

/** Administration lists are records, not period figures: no Provisional marker; each keeps its own empty message. */
const ADMIN_LOOK: ReportLook = { provisional: false, ownEmpty: true };

export interface AdminCardProps {
  title: string;
  /** what the card means, behind the ⓘ next to the title */
  info?: ReactNode;
  /** number of rows, after the title (left out when the list is paged without a total) */
  count?: number;
  /** at the right of the title */
  actions?: ReactNode;
  testId?: string;
  children: ReactNode;
}

/**
 * A card of the administration pages in the shared report look (cleanup 25 Oct 2026): h2 title with its ⓘ and
 * count, actions on the right, compact table rows with small uppercase headers.
 */
export function AdminCard({ title, info, count, actions, testId, children }: AdminCardProps) {
  const id = useId();
  const { number } = useNumberFormat();
  return (
    <ReportLookContext.Provider value={ADMIN_LOOK}>
      <section aria-labelledby={id} className="min-w-0 space-y-3 rounded-lg border bg-card p-4" data-testid={testId}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <h2 id={id} className="text-base font-semibold text-heading">
              {title}
            </h2>
            {count !== undefined && <span className="text-sm text-muted-foreground">{number(count)}</span>}
            {info && <KpiInfo label={title} text={info} />}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2 whitespace-nowrap">{actions}</div>}
        </div>
        {children}
      </section>
    </ReportLookContext.Provider>
  );
}
