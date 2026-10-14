import { Button } from '@/components/ui/button';
import { useCalendarPreference } from '@/lib/dates';
import { DurationText } from '@/features/ux-kit/duration-text';
import { EventTable } from '@/features/event-hub/components/event-table';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { Section } from '@/features/ux-kit/page-layout';
import type { DowntimeFilters } from '../model/downtime-filters';
import { formatCount } from '../model/kpi-display';
import { drillEventQuery, type DrillSelection } from '../model/reason-drill';

export interface DrillEventsProps {
  filters: DowntimeFilters;
  selection: DrillSelection;
  onDismiss: () => void;
}

/**
 * Drill-through of a Pareto bar (AN01): the downtime events of the same units, window and schedule
 * class, coded in the bar's subtree — a server-paged table (20 per page) next to the figure the bar
 * showed; a row opens the event page, Back returns here with the same filters.
 */
export function DrillEvents({ filters, selection, onDismiss }: DrillEventsProps) {
  const env = useEventHubEnv();
  const { digits } = useCalendarPreference();
  return (
    <Section
      title={`Events · ${selection.label}`}
      className="rounded-md border p-4"
      actions={<Button size="sm" variant="ghost" onClick={onDismiss}>Close list</Button>}
      description={
        <>
          Bar: {selection.unit === 'count' ? `${formatCount(selection.group.value, digits)} stops` : <DurationText seconds={selection.group.value} />}. Frequency
          counts stop occurrences starting in the window; durations are allocated, so an overlapping stop shares its time with the other causes.
        </>
      }
    >
      <div data-testid="drill-events" data-reason-id={selection.reasonId ?? ''}>
        <EventTable caption={`Events coded ${selection.label}`} query={drillEventQuery(filters, selection.reasonId, env.allReasonCodes)} testId="drill-event-list" />
      </div>
    </Section>
  );
}
