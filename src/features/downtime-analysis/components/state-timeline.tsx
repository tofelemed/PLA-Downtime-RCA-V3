import { useLocation, useNavigate } from 'react-router-dom';
import { useProductionEvents } from '@/api/v2/queries/production-events';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import type { ProductionEventView } from '@/api/v2/types/events';
import { Button } from '@/components/ui/button';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { formatDuration } from '@/features/ux-kit/format/duration';
import { labelOf, SCHEDULE_CLASS_LABELS } from '@/features/ux-kit/labels';
import { Section } from '@/features/ux-kit/page-layout';
import { VirtualList } from '@/features/ux-kit/virtual-list';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { usePlantFormat } from '@/features/event-hub/hooks/use-plant-format';
import type { DowntimeFilters } from '../model/downtime-filters';
import { timelineRows, type TimelineRow } from '../model/timeline';

const ROW_HEIGHT = 36;
const PAGE = 500;
const HATCH = 'repeating-linear-gradient(45deg, hsl(0 0% 45%) 0 3px, hsl(0 0% 85%) 3px 6px)';


/**
 * State timeline (lazy chunk): downtime intervals per unit across the window, unknown schedule class
 * hatched, running stops to the server's as-of; a bar opens the event page. Rows are virtualized;
 * the events come page by page from the server (until the 1.10 state segments exist).
 */
export function StateTimeline({ filters }: { filters: DowntimeFilters }) {
  const env = useEventHubEnv();
  const { dateTime } = usePlantFormat();
  const navigate = useNavigate();
  const location = useLocation();
  const onOpen = (event: ProductionEventView) => navigate(`/events/${event.id}`, { state: { listSearch: `${location.pathname}${location.search}` } });
  const query = useProductionEvents(
    {
      limit: PAGE,
      sort: '-startTime',
      from: filters.from,
      to: filters.to,
      physicalTypes: ['downtime'],
      physicalStates: ['closed', 'open'],
      ...(filters.unitIds.length > 0 ? { unitIds: [...filters.unitIds].sort() } : {}),
    },
    env.timezone,
  );
  const events = flattenPages(query.data?.pages);
  const rows = timelineRows(events, filters);
  return (
    <Section
      title="Stop timeline"
      className="rounded-md border p-4"
      actions={
        query.hasNextPage && (
          <Button size="sm" variant="outline" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>
            Load more stops
          </Button>
        )
      }
    >
      <div className="space-y-2" data-testid="state-timeline">
        <p className="text-xs text-muted-foreground">
          {dateTime(filters.from)} – {dateTime(filters.to)} · hatched = schedule class unknown · outlined = still running
        </p>
        <DataState state={dataStateOf(query, { isEmpty: rows.length === 0 })} error={query.error} onRetry={() => query.refetch()}>
          <VirtualList
            items={rows}
            rowHeight={ROW_HEIGHT}
            height={Math.min(rows.length, 8) * ROW_HEIGHT + 4}
            getKey={(row) => row.unitId}
            renderRow={(row) => <TimelineLane row={row} unitName={env.unitName(row.unitId)} dateTime={dateTime} onOpen={onOpen} />}
          />
        </DataState>
      </div>
    </Section>
  );
}

interface LaneProps {
  row: TimelineRow;
  unitName: string;
  dateTime: (iso: string) => string;
  onOpen: (event: ProductionEventView) => void;
}

function TimelineLane({ row, unitName, dateTime, onOpen }: LaneProps) {
  return (
    <div className="flex items-center gap-2" style={{ height: ROW_HEIGHT }} data-testid="timeline-lane" data-unit-id={row.unitId}>
      <span className="w-32 shrink-0 truncate text-xs">{unitName}</span>
      <div className="relative h-5 flex-1 rounded bg-muted">
        {row.segments.map((segment) => {
          const { event } = segment;
          const label = `${dateTime(event.startTime)} · ${event.isOpen ? 'running' : formatDuration(event.durationSeconds, 'compact')} · ${labelOf(SCHEDULE_CLASS_LABELS, event.classification.scheduleClass)}`;
          return (
            <button
              key={event.id}
              type="button"
              title={label}
              aria-label={`Stop ${label}`}
              data-testid="timeline-segment"
              className={`absolute top-0 h-5 rounded-sm ${segment.open ? 'border-2 border-destructive' : ''}`}
              style={{
                left: `${segment.left}%`,
                width: `${segment.width}%`,
                background: segment.unknown ? HATCH : 'hsl(var(--destructive))',
              }}
              onClick={() => onOpen(event)}
            />
          );
        })}
      </div>
    </div>
  );
}
