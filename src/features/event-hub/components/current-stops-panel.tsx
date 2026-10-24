import { Link, useLocation } from 'react-router-dom';
import { useProductionEvents } from '@/api/v2/queries/production-events';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import type { ProductionEventView } from '@/api/v2/types/events';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { DurationText } from '@/features/ux-kit/duration-text';
import { labelOf, PHYSICAL_TYPE_LABELS } from '@/features/ux-kit/labels';
import { Section } from '@/features/ux-kit/page-layout';
import { defaultFilters, currentStopsQuery } from '../model/event-filters';
import { usePlantFormat } from '../hooks/use-plant-format';
import { usePrefetchEvent } from '../hooks/use-prefetch-event';
import { useEventHubEnv } from '../use-event-hub-env';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { UnitLabel } from './unit-label';

/** The server computes elapsed time as of `asOf`; refreshed every 30 s and on realtime notices. */
const CURRENT_STOPS_REFRESH_MS = 30_000;

export interface CurrentStopsPanelProps {
  unitIds: readonly string[];
  onClose: (event: ProductionEventView) => void;
  /** FE-06 inline "Code" (absent: no Code button) */
  onCode?: (event: ProductionEventView) => void;
}

/**
 * Ongoing (open) events of the chosen units (§16.2 current stops), independent of the list window: cards
 * that fill the available width (a strip above the Event Hub table), one quiet line ("Current stops (0)") when none is running.
 */
export function CurrentStopsPanel({ unitIds, onClose, onCode }: CurrentStopsPanelProps) {
  const { number } = useNumberFormat();
  const env = useEventHubEnv();
  const filters = { ...defaultFilters({ from: '', to: '', label: '' }), unitIds: [...unitIds] };
  const query = useProductionEvents(currentStopsQuery(filters), env.timezone, { refetchInterval: CURRENT_STOPS_REFRESH_MS });
  const stops = flattenPages(query.data?.pages);
  const state = dataStateOf(query, { isEmpty: stops.length === 0 });
  const count = query.hasNextPage ? `${number(stops.length)}+` : number(stops.length);
  if (state === 'empty') {
    // nothing running: one quiet line instead of an empty box (the count says it)
    return (
      <p className="rounded-md border px-3 py-2 text-sm font-medium" data-testid="current-stops" data-empty="true">
        Current stops (0)
      </p>
    );
  }
  return (
    <Section title={`Current stops (${count})`} headingLevel={2} className="rounded-md border p-3">
      <div data-testid="current-stops" className="space-y-2">
        <DataState state={state} error={query.error} onRetry={() => query.refetch()}>
          {/* cards side by side, as many as fit the width (one column in a narrow side panel) */}
          <ul className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(17rem,1fr))]">
            {stops.map((stop) => (
              <CurrentStop key={stop.id} stop={stop} onClose={onClose} onCode={onCode} />
            ))}
          </ul>
        </DataState>
        {query.hasNextPage && (
          <Button size="sm" variant="outline" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
            Show more ongoing stops
          </Button>
        )}
      </div>
    </Section>
  );
}

interface CurrentStopProps {
  stop: ProductionEventView;
  onClose: CurrentStopsPanelProps['onClose'];
  onCode?: CurrentStopsPanelProps['onCode'];
}

function CurrentStop({ stop, onClose, onCode }: CurrentStopProps) {
  const { canWriteEvents } = useCapabilities();
  const env = useEventHubEnv();
  const { dateTime } = usePlantFormat();
  const { prefetch } = usePrefetchEvent();
  const location = useLocation();
  return (
    <li className="rounded border p-2 text-sm" data-testid="current-stop" data-event-id={stop.id}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium"><UnitLabel unitId={stop.unitId} /></span>
        <span data-testid="current-stop-elapsed" className="tabular-nums">
          Ongoing <DurationText seconds={stop.elapsedSeconds} />
        </span>
      </div>
      <div className="text-xs text-muted-foreground">
        {labelOf(PHYSICAL_TYPE_LABELS, stop.classification.physicalType)} since {dateTime(stop.startTime)} · as of {dateTime(stop.asOf)}
      </div>
      <div className="text-xs">{env.reasonName(stop.reasonCodeId)}</div>
      <div className="mt-1 flex gap-2">
        <Button size="sm" variant="outline" asChild>
          <Link to={`/events/${stop.id}`} state={{ listSearch: `${location.pathname}${location.search}` }} onMouseEnter={() => prefetch(stop.id)}>
            Open
          </Link>
        </Button>
        {canWriteEvents && (
          <Button size="sm" variant="outline" onClick={() => onClose(stop)} data-testid="current-stop-close">
            Close stop
          </Button>
        )}
        {canWriteEvents && onCode && (
          <Button size="sm" variant="outline" onClick={() => onCode(stop)} data-testid="current-stop-code">
            Code
          </Button>
        )}
      </div>
    </li>
  );
}
