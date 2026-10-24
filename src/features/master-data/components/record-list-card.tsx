import { useId, type ReactNode } from 'react';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { NumberText } from '@/features/ux-kit/number-text';
import { ReportLookContext, type ReportLook } from '@/features/ux-kit/report-look';

/** Setup lists are records, not period figures: no Provisional marker; each list keeps its own empty message. */
const RECORD_LOOK: ReportLook = { provisional: false, ownEmpty: true };

export interface RecordListCardProps {
  title: string;
  /** what the list means, behind the ⓘ next to the title */
  info?: ReactNode;
  /** rows in the list, shown after the title when known */
  count?: number;
  /** at the right of the title */
  actions?: ReactNode;
  testId?: string;
  children: ReactNode;
}

/**
 * A list of the Plant & equipment and Organizations & plants pages in the shared report look (cleanup
 * 25 Oct 2026): card with an h2 title, count and ⓘ, actions on the right; compact table rows with small
 * uppercase headers.
 */
export function RecordListCard({ title, info, count, actions, testId, children }: RecordListCardProps) {
  const id = useId();
  return (
    <ReportLookContext.Provider value={RECORD_LOOK}>
      <section aria-labelledby={id} className="min-w-0 space-y-3 rounded-lg border bg-card p-4" data-testid={testId}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <h2 id={id} className="text-base font-semibold text-heading">
              {title}
            </h2>
            {count !== undefined && (
              <span className="text-sm text-muted-foreground" data-testid="record-list-count">
                <NumberText value={count} />
              </span>
            )}
            {info && <KpiInfo label={title} text={info} />}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2 whitespace-nowrap">{actions}</div>}
        </div>
        {children}
      </section>
    </ReportLookContext.Provider>
  );
}
