import { useNavigate } from 'react-router-dom';
import { useCodeRoots } from '@/api/v2/queries/codes-admin';
import type { CodeDetailView, CodeLibraryPath } from '@/api/v2/types/codes-admin';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { CODE_LIBRARY_EMPTY, LIBRARIES } from '../model/code-fields';
import { CodeStatusBadge } from './code-status-badge';

export interface CodeFlatTableProps {
  library: CodeLibraryPath;
  includeRetired: boolean;
}

function columnsOf(library: CodeLibraryPath): Array<DataTableColumn<CodeDetailView>> {
  const fields = LIBRARIES[library].fields;
  return [
    { id: 'code', header: 'Code', nowrap: true, cell: (code) => <span className="font-mono" data-testid="code-row" data-code={code.code}>{code.code}</span> },
    { id: 'name', header: 'Name', cell: (code) => code.name },
    ...(fields.includes('category') ? [{ id: 'category', header: 'Category', cell: (code: CodeDetailView) => code.category ?? '—' }] : []),
    ...(fields.includes('costPerHour')
      ? [{ id: 'cost', header: 'Cost per hour', align: 'right' as const, nowrap: true, cell: (code: CodeDetailView) => code.costPerHour ?? '—' }]
      : []),
    { id: 'status', header: 'Status', cell: (code) => <CodeStatusBadge active={code.active} /> },
  ];
}

/** A library without hierarchy (impact, OEE codes) as a table, 20 codes per page, sorted by code. */
export function CodeFlatTable({ library, includeRetired }: CodeFlatTableProps) {
  const navigate = useNavigate();
  const codes = useCodeRoots(library, false, includeRetired);
  return (
    <DataTable
      caption={LIBRARIES[library].label}
      columns={columnsOf(library)}
      rows={codes.rows}
      getRowKey={(code) => code.id}
      pager={codes.pager}
      status={codes.status}
      empty={CODE_LIBRARY_EMPTY}
      onRowClick={(code) => navigate(`/master-data/codes-rules/${library}/${code.id}`)}
      rowLabel={(code) => `${code.code} ${code.name}`}
    />
  );
}
