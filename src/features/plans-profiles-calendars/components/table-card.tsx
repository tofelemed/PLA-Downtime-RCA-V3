import { useId, type ReactNode } from 'react';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { ReportLookContext } from '@/features/ux-kit/report-look';
import { SETUP_LOOK } from '../model/setup-look';

export interface TableCardProps {
  title: string;
  /** what the list means, behind an ⓘ beside the title */
  info?: ReactNode;
  /** small buttons at the right of the title */
  actions?: ReactNode;
  /** h3 for a card under another card's h2 */
  level?: 2 | 3;
  testId?: string;
  children: ReactNode;
}

/** One table of a Setup page: a `rounded-lg border bg-card p-4` card with its title (and ⓘ), actions right, in the report look. */
export function TableCard({ title, info, actions, level = 2, testId, children }: TableCardProps) {
  const id = useId();
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <ReportLookContext.Provider value={SETUP_LOOK}>
      <section aria-labelledby={id} className="min-w-0 rounded-lg border bg-card p-4" data-testid={testId}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Heading id={id} className="text-base font-semibold text-heading">
              {title}
            </Heading>
            {info && <KpiInfo label={title} text={info} />}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        {children}
      </section>
    </ReportLookContext.Provider>
  );
}
