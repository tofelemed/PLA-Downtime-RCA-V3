import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useReconciliationQueue } from '@/api/v2/queries/period-sla';
import type { QueueItemView } from '@/api/v2/types/period-sla';
import { QUEUE_TASK_LABELS } from '@/features/plan-dashboard/model/sla-labels';
import { SlaBadges } from '@/features/plan-dashboard/sla/sla-badges';
import { DataTable, ListPager, type DataTableColumn, type DataTableProps } from '@/features/ux-kit/data-table';
import { Section } from '@/features/ux-kit/page-layout';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { StatusBadge } from '@/features/ux-kit/status-badge';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { type CalendarPreference, formatOperationalDate, useCalendarPreference } from '@/lib/dates';
import { NoPlanLink } from './components/no-plan-notice';
import { groupQueueRows } from './my-queue-groups';

const periodHref = (row: QueueItemView) => (row.planId ? `/plans/${row.planId}/periods/${row.periodId}` : null);

function OpenLink({ row }: { row: QueueItemView }) {
  const href = periodHref(row);
  // the server lists only plan-covered periods; one resolved before its plan's recalculation has no link yet
  if (!href) return <NoPlanLink />;
  return (
    <Link to={href} className="text-sm underline" onClick={(event) => event.stopPropagation()} data-testid="queue-open">
      Open
    </Link>
  );
}

function columns(timezone: string, pref: CalendarPreference): DataTableColumn<QueueItemView>[] {
  return [
    {
      id: 'task',
      header: 'To do',
      // escalation is information (who acts now), not an alarm: only Overdue is red (in Status)
      cell: (row) => (
        <StatusBadge tone={row.task === 'escalated' ? 'info' : 'neutral'} data-testid="queue-task" data-task={row.task}>
          {QUEUE_TASK_LABELS[row.task]}
        </StatusBadge>
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
    { id: 'open', header: '', headerLabel: 'Actions', align: 'right', cell: (row) => <OpenLink row={row} /> },
  ];
}

type QueueTableProps = Omit<DataTableProps<QueueItemView>, 'caption' | 'getRowKey'>;

function QueueTable({ title, ...props }: QueueTableProps & { title: string }) {
  const navigate = useNavigate();
  return (
    <DataTable
      {...props}
      caption={title}
      getRowKey={(row) => row.periodId}
      density="compact"
      onRowClick={(row) => {
        const href = periodHref(row);
        if (href) navigate(href);
      }}
      rowsHaveLink
    />
  );
}

const EMPTY = { title: 'Nothing waiting for you', text: 'No ended period of the last two months needs your action.' };

/**
 * "My work" → Periods (SME R3 / R6, phase R-C): the reconciliation queue the server picks and orders,
 * shown grouped Overdue / Due today / Later.
 */
export function MyPeriodsTab() {
  const pref = useCalendarPreference();
  const { timezone } = usePlantTimezone();
  const queue = useReconciliationQueue();
  const { number } = useNumberFormat();
  const [now] = useState(() => new Date().toISOString());
  const cols = columns(timezone, pref);
  const settled = !queue.status.isLoading && !queue.status.isError && queue.rows.length > 0;
  return (
    <div className="space-y-4" data-testid="my-work-periods">
      <p className="text-sm text-muted-foreground">
        Periods waiting for you — to prepare, to review, or escalated to your role — earliest due first. Deadlines follow the plant&apos;s reconciliation policy.
      </p>
      {!settled && <QueueTable title="My reconciliation queue" columns={cols} rows={queue.rows} pager={queue.pager} status={queue.status} empty={EMPTY} />}
      {settled && groupQueueRows(queue.rows, now, timezone).map((group) => (
        <Section key={group.key} title={`${group.title} (${number(group.rows.length)})`} headingLevel={3}>
          <QueueTable title={`My reconciliation queue: ${group.title}`} columns={cols} rows={group.rows} pager="none" />
        </Section>
      ))}
      {settled && <ListPager pager={queue.pager} label="My reconciliation queue pages" />}
    </div>
  );
}
