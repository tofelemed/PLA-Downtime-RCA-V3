import { useProductionEvents } from '@/api/v2/queries/production-events';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import type { ProductionEventView } from '@/api/v2/types/events';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DurationText } from '@/features/ux-kit/duration-text';
import { EventList } from '@/features/event-hub/components/event-list';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import type { DowntimeFilters } from '../model/downtime-filters';
import { formatCount } from '../model/kpi-display';
import { drillEventQuery, type DrillSelection } from '../model/reason-drill';

const NO_SELECTION: ReadonlySet<string> = new Set();

export interface DrillEventsProps {
  filters: DowntimeFilters;
  selection: DrillSelection;
  onOpen: (event: ProductionEventView) => void;
  onDismiss: () => void;
}

/**
 * Drill-through of a Pareto bar (AN01): the downtime events of the same units, window and schedule
 * class, coded in the bar's subtree — a server keyset list next to the figure the bar showed.
 */
export function DrillEvents({ filters, selection, onOpen, onDismiss }: DrillEventsProps) {
  const env = useEventHubEnv();
  const query = useProductionEvents(drillEventQuery(filters, selection.reasonId, env.reasonCodes), env.timezone);
  const events = flattenPages(query.data?.pages);
  const listed = query.hasNextPage ? `${events.length}+` : String(events.length);
  return (
    <Card data-testid="drill-events" data-reason-id={selection.reasonId ?? ''}>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-base">Events · {selection.label}</CardTitle>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          Close list
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Bar:{' '}
          {selection.unit === 'count' ? (
            `${formatCount(selection.group.value)} stops`
          ) : (
            <DurationText seconds={selection.group.value} />
          )}{' '}
          · <span data-testid="drill-count">{listed}</span> events listed. Frequency counts stop occurrences starting in the window;
          durations are allocated, so an overlapping stop shares its time with the other causes.
        </p>
        <EventList events={events} query={query} selectedIds={NO_SELECTION} onToggle={() => undefined} onOpen={onOpen} height={320} />
      </CardContent>
    </Card>
  );
}
