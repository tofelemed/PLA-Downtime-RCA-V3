import { useEventStatus } from '@/api/v2/queries/ops-reports';
import type { EventStatusRowView } from '@/api/v2/types/ops-reports';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { DurationText } from '@/features/ux-kit/duration-text';
import { NumberText } from '@/features/ux-kit/number-text';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { scopeBase, type AnalyticsScope } from '@/features/pla-analytics/model/analytics-scope';

const TYPE_LABELS: Readonly<Record<string, string>> = {
  downtime: 'Stops',
  slowdown: 'Slowdowns',
  quality_loss: 'Quality losses',
  grade_transition: 'Grade transitions',
};

const COLUMNS: Array<DataTableColumn<EventStatusRowView>> = [
  { id: 'type', header: 'Events', cell: (row) => <span data-testid="event-status-row" data-type={row.physicalType}>{TYPE_LABELS[row.physicalType] ?? row.physicalType}</span> },
  { id: 'events', header: 'Total', align: 'right', cell: (row) => <NumberText value={row.events} /> },
  { id: 'open', header: 'Still running', align: 'right', cell: (row) => <NumberText value={row.open} /> },
  { id: 'uncoded', header: 'Not coded', align: 'right', cell: (row) => <NumberText value={row.uncoded} /> },
  { id: 'verified', header: 'Verified', align: 'right', cell: (row) => <NumberText value={row.verified} /> },
  { id: 'seconds', header: 'Duration', align: 'right', nowrap: true, cell: (row) => <DurationText seconds={row.seconds} /> },
  { id: 'uncodedSeconds', header: 'Not coded duration', align: 'right', nowrap: true, cell: (row) => <DurationText seconds={row.uncodedSeconds} /> },
];

/** How far the window's loss events are coded and verified (R1): what the figures above can be trusted for. */
export function EventStatusCard({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const query = useEventStatus(scopeBase(scope), env.timezone);
  const rows = query.data?.rows ?? [];
  const state = dataStateOf(query, { isEmpty: query.data !== undefined && rows.length === 0 });
  return (
    <Card data-testid="daily-event-status">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Events: coding and verification</CardTitle>
      </CardHeader>
      <CardContent>
        <DataState state={state} error={query.error} detail={state === 'empty' ? 'No loss events start on these dates.' : undefined} onRetry={() => void query.refetch()}>
          <DataTable caption="Events: coding and verification" columns={COLUMNS} rows={rows} getRowKey={(row) => row.physicalType} density="compact" />
        </DataState>
      </CardContent>
    </Card>
  );
}
