import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePrefetchRcaCase, useRcaCasePage } from '@/api/v2/queries/rca-cases';
import type { RcaCaseListItemView } from '@/api/v2/types/rca';
import { DataTable, type DataTableColumn, type DataTableEmpty } from '@/features/ux-kit/data-table';
import { PRIORITY_TONES, RCA_CASE_STATUS_TONES, useUserNames } from '@/features/ux-kit/labels';
import { StatusBadge } from '@/features/ux-kit/status-badge';
import { toneOf } from '@/features/ux-kit/status-tone';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import type { CaseListFilters } from '../model/case-filters';
import { toCaseQuery } from '../model/case-filters';
import { useRcaFormat } from '../use-rca-format';
import { useUnitNames } from '../use-unit-names';
import { actionProgressText, statusLabel } from '../model/rca-labels';

interface ColumnContext {
  unitName: (id: string | null) => string;
  userName: (id: string | null) => string;
  day: (value: string | null) => string;
  date: (value: string | null) => string;
  dateTime: (value: string | null) => string;
  prefetch: (id: string) => void;
}

function TriggerCell({ row, dateTime }: { row: RcaCaseListItemView; dateTime: ColumnContext['dateTime'] }) {
  if (!row.trigger) return <span className="text-muted-foreground">No linked stop</span>;
  return (
    <Link className="underline" to={`/events/${encodeURIComponent(row.trigger.eventId)}`} data-testid="case-trigger">
      Stop {dateTime(row.trigger.startTime)}
    </Link>
  );
}

function ActionsCell({ row }: { row: RcaCaseListItemView }) {
  const { number } = useNumberFormat();
  if (row.actions.total === 0) return <span className="text-muted-foreground">No actions</span>;
  return (
    <span className={row.actions.overdue > 0 ? 'font-medium text-destructive' : undefined} data-testid="case-actions">
      {actionProgressText(row.actions, number)}
    </span>
  );
}

function caseColumns(context: ColumnContext): DataTableColumn<RcaCaseListItemView>[] {
  return [
    {
      id: 'title',
      header: 'Investigation',
      cell: (row) => (
        <span className="font-medium" onMouseEnter={() => context.prefetch(row.id)}>
          {row.title}
        </span>
      ),
    },
    { id: 'status', header: 'Status', cell: (row) => <StatusBadge tone={toneOf(RCA_CASE_STATUS_TONES, row.status ?? 'Draft')}>{statusLabel(row.status)}</StatusBadge>, nowrap: true },
    { id: 'priority', header: 'Priority', cell: (row) => <StatusBadge tone={toneOf(PRIORITY_TONES, row.priority ?? 'Medium')}>{row.priority ?? 'Medium'}</StatusBadge>, nowrap: true },
    { id: 'lead', header: 'Lead', cell: (row) => (row.teamLeadId ? context.userName(row.teamLeadId) : <span className="text-muted-foreground">No lead</span>) },
    { id: 'unit', header: 'Unit', cell: (row) => context.unitName(row.unitId) },
    { id: 'trigger', header: 'Trigger', cell: (row) => <TriggerCell row={row} dateTime={context.dateTime} />, nowrap: true },
    { id: 'actions', header: 'Actions', cell: (row) => <ActionsCell row={row} />, nowrap: true },
    { id: 'target', header: 'Target close', cell: (row) => context.day(row.targetCloseDate), nowrap: true },
    { id: 'opened', header: 'Opened', cell: (row) => context.date(row.createdAt), nowrap: true },
  ];
}

/** The cases of the scope, 20 per server page, newest first, with trigger event and action progress; a row opens the case. */
export function CaseTable({ filters, empty }: { filters: CaseListFilters; empty: DataTableEmpty }) {
  const navigate = useNavigate();
  const { unitName } = useUnitNames();
  const { day, date, dateTime } = useRcaFormat();
  const prefetch = usePrefetchRcaCase();
  const paged = useRcaCasePage(toCaseQuery(filters));
  const leadIds = useMemo(() => paged.rows.map((row) => row.teamLeadId), [paged.rows]);
  const users = useUserNames(leadIds);
  const columns = useMemo(() => caseColumns({ unitName, userName: users.nameOf, day, date, dateTime, prefetch }), [unitName, users.nameOf, day, date, dateTime, prefetch]);
  return (
    <div data-testid="case-list">
      <DataTable
        caption="Investigations"
        columns={columns}
        rows={paged.rows}
        getRowKey={(row) => row.id}
        pager={paged.pager}
        status={paged.status}
        empty={empty}
        onRowClick={(row) => navigate(`/rca/${row.id}`)}
        rowLabel={(row) => `Open investigation ${row.title}`}
      />
    </div>
  );
}
