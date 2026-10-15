import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { useReconciliationQueue } from '@/api/v2/queries/period-sla';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import type { QueueItemView } from '@/api/v2/types/period-sla';
import { QUEUE_TASK_LABELS } from '@/features/plan-dashboard/model/sla-labels';
import { SlaBadges } from '@/features/plan-dashboard/sla/sla-badges';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { DataState } from '@/features/ux-kit/data-state';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { type CalendarPreference, formatOperationalDate, useCalendarPreference } from '@/lib/dates';

function columns(timezone: string, pref: CalendarPreference): DataTableColumn<QueueItemView>[] {
  return [
    {
      id: 'task',
      header: 'To do',
      cell: (row) => (
        <Badge variant={row.task === 'escalated' ? 'destructive' : 'secondary'} data-testid="queue-task" data-task={row.task}>
          {QUEUE_TASK_LABELS[row.task]}
        </Badge>
      ),
    },
    {
      id: 'period',
      header: 'Period',
      nowrap: true,
      cell: (row) => (
        <span data-testid="queue-row" data-period-id={row.periodId}>
          {row.unitName ?? 'Unit'} · {formatOperationalDate(row.localDate, pref)}
          {row.shiftName ? ` · ${row.shiftName}` : ''}
        </span>
      ),
    },
    { id: 'due', header: 'Due', nowrap: true, cell: (row) => (row.onHold ? 'paused' : <PlantTime iso={row.dueAt} tz={timezone} withDate />) },
    { id: 'flags', header: 'Status', cell: (row) => <SlaBadges sla={row} /> },
  ];
}

function QueueScreen() {
  const navigate = useNavigate();
  const pref = useCalendarPreference();
  const { timezone } = usePlantTimezone();
  const queue = useReconciliationQueue();
  return (
    <Page width="wide">
      <div className="space-y-4" data-testid="my-queue">
        <PageHeader title="My queue" description="Periods waiting for you — to prepare, to review, or escalated to your role — earliest due first. Deadlines follow the plant's reconciliation policy." />
        <DataTable
          caption="My reconciliation queue"
          columns={columns(timezone, pref)}
          rows={queue.rows}
          getRowKey={(row) => row.periodId}
          pager={queue.pager}
          status={queue.status}
          density="compact"
          empty={{ title: 'Nothing waiting for you', text: 'No ended period of the last two months needs your action.' }}
          onRowClick={(row) => row.planId && navigate(`/plans/${row.planId}/periods/${row.periodId}`)}
          rowLabel={(row) => `Open period ${row.localDate}${row.shiftName ? ` ${row.shiftName}` : ''}`}
        />
      </div>
    </Page>
  );
}

/** "My queue" (SME R3 / R6, phase R-C) at `/my-queue`: the server picks the periods and their order. */
export function MyQueuePage() {
  const tenantId = useV2TenantId();
  if (!tenantId) return <DataState state="no-permission" detail="Choose a plant to see its reconciliation queue." />;
  return <QueueScreen />;
}
