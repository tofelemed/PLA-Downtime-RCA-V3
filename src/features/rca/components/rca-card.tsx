import { useId, useState, type ReactNode } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { ReportLookContext, type ReportLook } from '@/features/ux-kit/report-look';
import { UiIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';

/** RCA lists are records, not period figures: no Provisional marker; a list's own empty message ("No investigation matches…") stays. */
const RCA_LOOK: ReportLook = { provisional: false, ownEmpty: true };

export interface RcaCardProps {
  title: string;
  /** what the list means, behind the ⓘ next to the title */
  info?: ReactNode;
  /** at the right of the title */
  actions?: ReactNode;
  /** the title becomes a disclosure button, closed at first */
  collapsible?: boolean;
  testId?: string;
  children: ReactNode;
}

function CardTitle({ id, title, collapsible, open }: { id: string; title: string; collapsible: boolean; open: boolean }) {
  if (!collapsible) {
    return (
      <h2 id={id} className="text-base font-semibold text-heading">
        {title}
      </h2>
    );
  }
  return (
    <h2 id={id} className="text-base font-semibold text-heading">
      <CollapsibleTrigger className="inline-flex items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <UiIcon.expand aria-hidden="true" className={cn('h-4 w-4 transition-transform', !open && '-rotate-90')} />
        {title}
      </CollapsibleTrigger>
    </h2>
  );
}

/**
 * A list of the RCA and knowledge-base pages in the shared report look (cleanup 24 Oct 2026): card with an h2
 * title, its ⓘ and actions on the right; compact table rows with small uppercase headers.
 */
export function RcaCard({ title, info, actions, collapsible = false, testId, children }: RcaCardProps) {
  const id = useId();
  const [open, setOpen] = useState(!collapsible);
  return (
    <ReportLookContext.Provider value={RCA_LOOK}>
      <Collapsible open={open} onOpenChange={setOpen} asChild>
        <section aria-labelledby={id} className="min-w-0 rounded-lg border bg-card p-4" data-testid={testId}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <CardTitle id={id} title={title} collapsible={collapsible} open={open} />
              {info && <KpiInfo label={title} text={info} />}
            </div>
            {actions}
          </div>
          <CollapsibleContent className="mt-3">{children}</CollapsibleContent>
        </section>
      </Collapsible>
    </ReportLookContext.Provider>
  );
}
