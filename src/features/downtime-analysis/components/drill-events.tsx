import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { useCalendarPreference } from '@/lib/dates';
import { DurationText } from '@/features/ux-kit/duration-text';
import { ReportLookContext, type ReportLook } from '@/features/ux-kit/report-look';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { EventTable } from '@/features/event-hub/components/event-table';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import type { DowntimeFilters } from '../model/downtime-filters';
import { formatCount } from '../model/kpi-display';
import { drillEventQuery, type DrillSelection } from '../model/reason-drill';

export interface DrillEventsProps {
  filters: DowntimeFilters;
  selection: DrillSelection;
  onDismiss: () => void;
}

/** Stop rows are facts, not period figures: no Provisional marker in the table. */
const DRILL_LOOK: ReportLook = { provisional: false };
const DRILL_INFO =
  'Stops of the same units, window and schedule class coded in this reason. Frequency counts stop occurrences starting in the window; durations are allocated, so an overlapping stop shares its time with the other causes.';

/**
 * Drill-through of a Pareto bar (AN01): the downtime events of the same units, window and schedule
 * class, coded in the bar's subtree — a server-paged table (20 per page) in a card titled with the bar
 * and its figure; a row opens the event page, Back returns here with the same filters.
 */
export function DrillEvents({ filters, selection, onDismiss }: DrillEventsProps) {
  const env = useEventHubEnv();
  const { digits } = useCalendarPreference();
  const headingId = useId();
  const figure = selection.unit === 'count' ? `${formatCount(selection.group.value, digits)} stops` : <DurationText seconds={selection.group.value} />;
  return (
    <ReportLookContext.Provider value={DRILL_LOOK}>
      <section aria-labelledby={headingId} className="min-w-0 space-y-3 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 id={headingId} className="text-base font-semibold text-heading">Stops · {selection.label}</h2>
            <span className="text-sm tabular-nums text-muted-foreground" data-testid="drill-figure">{figure}</span>
            <KpiInfo label={`Stops · ${selection.label}`} text={DRILL_INFO} />
          </div>
          <Button size="sm" variant="ghost" onClick={onDismiss}>Close list</Button>
        </div>
        <div data-testid="drill-events" data-reason-id={selection.reasonId ?? ''}>
          <EventTable caption={`Stops coded ${selection.label}`} query={drillEventQuery(filters, selection.reasonId, env.allReasonCodes)} testId="drill-event-list" />
        </div>
      </section>
    </ReportLookContext.Provider>
  );
}
