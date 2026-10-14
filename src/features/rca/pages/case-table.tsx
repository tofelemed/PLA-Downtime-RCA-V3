import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePrefetchRcaCase, useRcaCasePage } from '@/api/v2/queries/rca-cases';
import type { RcaCaseSummaryView } from '@/api/v2/types/rca';
import { Badge } from '@/components/ui/badge';
import { DataTable, type DataTableColumn, type DataTableEmpty } from '@/features/ux-kit/data-table';
import type { CaseListFilters } from '../model/case-filters';
import { toCaseQuery } from '../model/case-filters';
import { useRcaFormat } from '../use-rca-format';
import { useUnitNames } from '../use-unit-names';
import { statusLabel } from '../model/rca-labels';

interface ColumnContext {
  unitName: (id: string | null) => string;
  day: (value: string | null) => string;
  date: (value: string | null) => string;
  prefetch: (id: string) => void;
}

function caseColumns(context: ColumnContext): DataTableColumn<RcaCaseSummaryView>[] {
  return [
    {
      id: 'title',
      header: 'Case',
      cell: (row) => (
        <span className="font-medium" onMouseEnter={() => context.prefetch(row.id)}>
          {row.title}
        </span>
      ),
    },
    { id: 'status', header: 'Status', cell: (row) => <Badge variant="secondary">{statusLabel(row.status)}</Badge>, nowrap: true },
    { id: 'priority', header: 'Priority', cell: (row) => <Badge variant="outline">{row.priority ?? 'Medium'}</Badge>, nowrap: true },
    { id: 'unit', header: 'Unit', cell: (row) => context.unitName(row.unitId) },
    { id: 'target', header: 'Target close', cell: (row) => context.day(row.targetCloseDate), nowrap: true },
    { id: 'opened', header: 'Opened', cell: (row) => context.date(row.createdAt), nowrap: true },
  ];
}

/** The cases of the scope, 20 per server page, newest first; a row opens the case. */
export function CaseTable({ filters, empty }: { filters: CaseListFilters; empty: DataTableEmpty }) {
  const navigate = useNavigate();
  const { unitName } = useUnitNames();
  const { day, date } = useRcaFormat();
  const prefetch = usePrefetchRcaCase();
  const paged = useRcaCasePage(toCaseQuery(filters));
  const columns = useMemo(() => caseColumns({ unitName, day, date, prefetch }), [unitName, day, date, prefetch]);
  return (
    <div data-testid="case-list">
      <DataTable
        caption="RCA cases"
        columns={columns}
        rows={paged.rows}
        getRowKey={(row) => row.id}
        pager={paged.pager}
        status={paged.status}
        empty={empty}
        onRowClick={(row) => navigate(`/rca/${row.id}`)}
        rowLabel={(row) => `Open case ${row.title}`}
      />
    </div>
  );
}
