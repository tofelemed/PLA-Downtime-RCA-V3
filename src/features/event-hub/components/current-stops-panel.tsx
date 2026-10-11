import { useProductionEvents } from '@/api/v2/queries/production-events';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import type { ProductionEventView } from '@/api/v2/types/events';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { DurationText } from '@/features/ux-kit/duration-text';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { currentStopsQuery, type EventFilterState } from '../model/event-filters';
import { humanize } from '../model/event-states';
import { useEventHubEnv } from '../use-event-hub-env';

/** The server computes elapsed time as of `asOf`; refreshed every 30 s and on realtime notices. */
const CURRENT_STOPS_REFRESH_MS = 30_000;

export interface CurrentStopsPanelProps {
  filters: EventFilterState;
  onOpen: (event: ProductionEventView) => void;
  onClose: (event: ProductionEventView) => void;
}

/** Running events of the chosen units (§16.2 current stops), independent of the list window. */
export function CurrentStopsPanel({ filters, onOpen, onClose }: CurrentStopsPanelProps) {
  const { canWriteEvents } = useCapabilities();
  const env = useEventHubEnv();
  const query = useProductionEvents(currentStopsQuery(filters), env.timezone, { refetchInterval: CURRENT_STOPS_REFRESH_MS });
  const stops = flattenPages(query.data?.pages);
  const state = dataStateOf(query, { isEmpty: stops.length === 0 });
  return (
    <Card data-testid="current-stops">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Current stops ({stops.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <DataState state={state} error={query.error} onRetry={() => query.refetch()} detail={state === 'empty' ? 'Nothing is running.' : undefined}>
          <ul className="space-y-2">
            {stops.map((stop) => (
              <li key={stop.id} className="rounded border p-2 text-sm" data-testid="current-stop" data-event-id={stop.id}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{env.unitName(stop.unitId)}</span>
                  <span data-testid="current-stop-elapsed" className="font-mono">
                    <DurationText seconds={stop.elapsedSeconds} variant="clock" />
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {humanize(stop.classification.physicalType)} since <PlantTime iso={stop.startTime} tz={env.timezone} /> · as of{' '}
                  <PlantTime iso={stop.asOf} tz={env.timezone} />
                </div>
                <div className="text-xs">{env.reasonName(stop.reasonCodeId)}</div>
                <div className="mt-1 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => onOpen(stop)}>
                    Open
                  </Button>
                  {canWriteEvents && (
                    <Button size="sm" variant="outline" onClick={() => onClose(stop)} data-testid="current-stop-close">
                      Close stop
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </DataState>
      </CardContent>
    </Card>
  );
}
