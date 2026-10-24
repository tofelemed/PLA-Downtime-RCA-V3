import type { ReactNode } from 'react';
import type { ProductionEventFilters } from '@/api/v2/queries/production-events';
import type { DataTableEmpty } from '@/features/ux-kit/data-table';
import { ReportLookContext, type ReportLook } from '@/features/ux-kit/report-look';
import type { EventColumnContext } from './event-columns';
import { EventTable } from './event-table';

/** Event rows are facts, not period figures: no Provisional marker in the table (the downtime card carries it). */
const EVENT_LIST_LOOK: ReportLook = { provisional: false };

export interface EventListCardProps {
  query: ProductionEventFilters;
  selection?: EventColumnContext['selection'];
  onCode?: EventColumnContext['onCode'];
  sort?: EventColumnContext['sort'];
  empty?: DataTableEmpty;
  /** selection actions, at the right of the title */
  actions?: ReactNode;
  /** opt-in: the card title (default "Events") */
  title?: string;
  /** opt-in: test id of the table (default "event-list") */
  testId?: string;
}

/** The Event Hub list in a card with the shared report table look (compact rows, small uppercase headers). */
export function EventListCard({ actions, title = 'Events', ...table }: EventListCardProps) {
  return (
    <ReportLookContext.Provider value={EVENT_LIST_LOOK}>
      <section aria-labelledby="event-list-title" className="min-w-0 rounded-lg border bg-card p-4" data-testid="event-list-card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="event-list-title" className="text-base font-semibold text-heading">
            {title}
          </h2>
          {actions}
        </div>
        <EventTable caption="Production events" {...table} />
      </section>
    </ReportLookContext.Provider>
  );
}
