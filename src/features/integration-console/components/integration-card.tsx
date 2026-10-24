import { useId, type ReactNode } from 'react';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { ReportLookContext, type ReportLook } from '@/features/ux-kit/report-look';

/** Integration lists are records, not period figures: no Provisional marker; each list keeps its own empty message. */
const INTEGRATION_LOOK: ReportLook = { provisional: false, ownEmpty: true };

export interface IntegrationCardProps {
  title: string;
  /** what the card holds, behind the ⓘ next to the title */
  info?: ReactNode;
  /** at the right of the title (New …, Refresh) */
  actions?: ReactNode;
  testId?: string;
  children: ReactNode;
}

/**
 * A table or list of the Integration pages in the shared report look (cleanup 25 Oct 2026): a card with an h2
 * title, its ⓘ and actions on the right; compact table rows with small uppercase headers.
 */
export function IntegrationCard({ title, info, actions, testId, children }: IntegrationCardProps) {
  const id = useId();
  return (
    <ReportLookContext.Provider value={INTEGRATION_LOOK}>
      <section aria-labelledby={id} className="min-w-0 space-y-3 rounded-lg border bg-card p-4" data-testid={testId}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <h2 id={id} className="text-base font-semibold text-heading">
              {title}
            </h2>
            {info && <KpiInfo label={title} text={info} />}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2 whitespace-nowrap">{actions}</div>}
        </div>
        {children}
      </section>
    </ReportLookContext.Provider>
  );
}
