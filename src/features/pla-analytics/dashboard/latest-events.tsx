import { useNavigate } from 'react-router-dom';
import { useProductionEvents } from '@/api/v2/queries/production-events';
import type { ProductionEventView } from '@/api/v2/types/events';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { DurationText } from '@/features/ux-kit/duration-text';
import { labelOf, PHYSICAL_TYPE_LABELS } from '@/features/ux-kit/labels';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { useEventHubEnv, type EventHubEnv } from '@/features/event-hub/use-event-hub-env';
import type { AnalyticsScope } from '../model/analytics-scope';

const LATEST = 5;

function columnsOf(env: EventHubEnv): Array<DataTableColumn<ProductionEventView>> {
  return [
    { id: 'start', header: 'Start', nowrap: true, cell: (e) => <PlantTime iso={e.startTime} tz={env.timezone} withDate /> },
    { id: 'unit', header: 'Unit', cell: (e) => env.unitName(e.unitId) },
    { id: 'type', header: 'Type', cell: (e) => labelOf(PHYSICAL_TYPE_LABELS, e.classification.physicalType) },
    { id: 'reason', header: 'Reason', cell: (e) => (e.reasonCodeId ? env.reasonName(e.reasonCodeId) : 'Not coded') },
    { id: 'duration', header: 'Duration', align: 'right', nowrap: true, cell: (e) => (e.durationSeconds === null ? 'Running' : <DurationText seconds={e.durationSeconds} variant="clock" />) },
  ];
}

/**
 * The latest stops, slowdowns and quality losses of the window (the v1 "critical alerts / recent events"):
 * the newest five from the server, each opening its event page; the full list is in the Event Hub.
 */
export function LatestEvents({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const navigate = useNavigate();
  const query = useProductionEvents(
    { from: scope.from, to: scope.to, sort: '-startTime', limit: LATEST, physicalTypes: ['downtime', 'slowdown', 'quality_loss'], physicalStates: ['open', 'closed'] },
    env.timezone,
  );
  const rows = query.data?.pages[0]?.items ?? [];
  const state = dataStateOf(query);
  return (
    <div data-testid="dashboard-latest-events">
      <DataTable
          caption="Latest loss events"
          columns={columnsOf(env)}
          rows={rows}
          getRowKey={(e) => e.id}
          pager="none"
          status={{ isLoading: state === 'loading', isError: query.isError, error: query.error, onRetry: () => void query.refetch() }}
          empty={{ text: 'No loss events in this window.' }}
          onRowClick={(e) => navigate(`/events/${e.id}`)}
          rowLabel={(e) => `${labelOf(PHYSICAL_TYPE_LABELS, e.classification.physicalType)} on ${env.unitName(e.unitId)}`}
          density="compact"
        />
    </div>
  );
}
