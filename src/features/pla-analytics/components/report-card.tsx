import { useId, type HTMLAttributes, type ReactNode } from 'react';
import { ProvisionalMark } from '@/features/ux-kit/report-look';
import { KpiInfo } from '../dashboard/kpi-info';

/** `data-*` attributes of the card element (e.g. what end-to-end tests read). */
export type CardDataAttributes = Record<`data-${string}`, string | undefined>;

export interface ReportCardProps extends Pick<HTMLAttributes<HTMLElement>, 'aria-busy'> {
  title: string;
  testId?: string;
  /** what an operator needs to read the figures, behind an ⓘ beside the title */
  info?: ReactNode;
  /** a badge beside the title (e.g. the month's close state) */
  badge?: ReactNode;
  /** the response is provisional and its rows carry no quality: one marker beside the title (Revision = Provisional only) */
  provisional?: boolean;
  /** buttons, selects or export on the right */
  actions?: ReactNode;
  attributes?: CardDataAttributes;
  children: ReactNode;
}

/**
 * One card of the Reports page, in the dashboard's card look (`KpiSection`): a titled section, the title with
 * its ⓘ and markers on the left, actions and export on the right, then the content.
 */
export function ReportCard({ title, testId, info, badge, provisional, actions, attributes, children, ...rest }: ReportCardProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} data-testid={testId} className="relative min-w-0 space-y-3 rounded-lg border bg-card p-4" {...attributes} {...rest}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id={headingId} className="text-base font-semibold text-heading">
            {title}
          </h2>
          {info && <KpiInfo label={title} text={info} />}
          {badge}
          <ProvisionalMark when={provisional} />
        </div>
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
      {children}
    </section>
  );
}
