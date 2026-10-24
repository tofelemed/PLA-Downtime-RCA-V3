import { useDeferredValue, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCodeList } from '@/api/v2/queries/codes-admin';
import type { CodeDetailView, CodeLibraryPath } from '@/api/v2/types/codes-admin';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { ancestorsLabel, searchCodes } from '../model/code-tree';
import { LIBRARIES } from '../model/code-fields';
import { CodeStatusBadge } from './code-status-badge';

export interface CodeSearchResultsProps {
  library: CodeLibraryPath;
  includeRetired: boolean;
  /** the debounced search text */
  text: string;
}

/** Codes of the library whose code or name contains the text, at any depth, with where they sit. */
export function CodeSearchResults({ library, includeRetired, text }: CodeSearchResultsProps) {
  const navigate = useNavigate();
  const lookup = useCodeList(library, { includeRetired });
  const needle = useDeferredValue(text);
  const matches = useMemo(() => searchCodes(lookup.items, needle), [lookup.items, needle]);
  const columns: Array<DataTableColumn<CodeDetailView>> = [
    { id: 'code', header: 'Code', nowrap: true, cell: (code) => <span className="font-mono" data-testid="code-match" data-code={code.code}>{code.code}</span> },
    { id: 'name', header: 'Name', cell: (code) => code.name },
    ...(LIBRARIES[library].hierarchical ? [{ id: 'under', header: 'Under', cell: (code: CodeDetailView) => ancestorsLabel(lookup.items, code) || 'Top level' }] : []),
    { id: 'status', header: 'Status', cell: (code) => <CodeStatusBadge active={code.active} /> },
  ];
  return (
    <DataTable
      caption={`Codes matching “${needle}”`}
      columns={columns}
      rows={matches}
      getRowKey={(code) => code.id}
      status={{ isLoading: lookup.isLoading, isError: lookup.isError, error: lookup.error, onRetry: () => void lookup.refetch() }}
      empty={{ title: 'No matching codes', text: 'No code matches the search.' }}
      onRowClick={(code) => navigate(`/master-data/codes-rules/${library}/${code.id}`)}
      rowLabel={(code) => `${code.code} ${code.name}`}
    />
  );
}
