import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useRcaActionPage, type RcaActionQueueFilters } from '@/api/v2/queries/rca-pickers';
import type { RcaActionListItemView } from '@/api/v2/types/rca-pickers';
import { DataTable, type DataTableColumn, type DataTableEmpty } from '@/features/ux-kit/data-table';
import { labelOf, useUserNames } from '@/features/ux-kit/labels';
import { RCA_ACTION_STATUS_LABELS } from '@/features/ux-kit/labels/rca-labels';
import { StatusBadge } from '@/features/ux-kit/status-badge';
import { ACTION_STATUS_TONES, asActionStatus } from '../model/action-queue-filters';
import { useRcaFormat } from '../use-rca-format';
import { ActionOverdueBadge } from './action-meta';

interface ColumnContext {
  userName: (id: string | null) => string;
  day: (value: string | null) => string;
}

function DueCell({ action, day }: { action: RcaActionListItemView; day: ColumnContext['day'] }) {
  if (!action.dueDate) return <span className="text-muted-foreground">No due date</span>;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {day(action.dueDate)}
      <ActionOverdueBadge action={action} />
    </span>
  );
}

function columnsOf(context: ColumnContext): DataTableColumn<RcaActionListItemView>[] {
  return [
    { id: 'title', header: 'Action', cell: (action) => <span className="font-medium">{action.title}</span> },
    {
      id: 'case',
      header: 'Investigation',
      cell: (action) => (
        <Link className="underline" to={`/rca/${encodeURIComponent(action.case.id)}/actions`} data-testid="action-case-link">
          {action.case.title || 'Untitled investigation'}
        </Link>
      ),
    },
    { id: 'owner', header: 'Owner', cell: (action) => (action.ownerId ? context.userName(action.ownerId) : <span className="text-muted-foreground">No owner</span>) },
    { id: 'due', header: 'Due', cell: (action) => <DueCell action={action} day={context.day} />, nowrap: true },
    {
      id: 'status',
      header: 'Status',
      cell: (action) => (
        <StatusBadge tone={ACTION_STATUS_TONES[asActionStatus(action.status) ?? 'open']}>{labelOf(RCA_ACTION_STATUS_LABELS, action.status)}</StatusBadge>
      ),
      nowrap: true,
    },
  ];
}

export interface ActionQueueTableProps {
  filters: RcaActionQueueFilters;
  empty: DataTableEmpty;
  /** rows per page (default 20) */
  pageSize?: number;
  caption?: string;
}

/** F-7: actions across the investigations of the scope (`GET /v2/rca-actions`), due date first, keyset pages. */
export function ActionQueueTable({ filters, empty, pageSize, caption = 'Actions' }: ActionQueueTableProps) {
  const { day } = useRcaFormat();
  const paged = useRcaActionPage(filters, pageSize);
  const ownerIds = useMemo(() => paged.rows.map((row) => row.ownerId), [paged.rows]);
  const users = useUserNames(ownerIds);
  const columns = useMemo(() => columnsOf({ userName: users.nameOf, day }), [users.nameOf, day]);
  return (
    <DataTable
      caption={caption}
      columns={columns}
      rows={paged.rows}
      getRowKey={(row) => row.id}
      pager={paged.pager}
      status={paged.status}
      empty={empty}
    />
  );
}
