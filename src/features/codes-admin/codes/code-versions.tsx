import { useMemo } from 'react';
import { useCodeList, useCodeVersions } from '@/api/v2/queries/codes-admin';
import type { CodeDetailView, CodeLibraryPath } from '@/api/v2/types/codes-admin';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { FAILURE_GROUP_KIND_LABELS, labelOf } from '@/features/ux-kit/labels';
import { OEE_COMPONENT_LABELS, SCHEDULE_CLASS_LABELS } from '@/features/ux-kit/labels/codes-finance-labels';
import { usePlantDates } from '../hooks/use-plant-dates';
import { snapshotLabel, versionTimeline, type SnapshotChange, type VersionEntry } from '../model/version-diff';

export interface CodeVersionsProps {
  library: CodeLibraryPath;
  code: CodeDetailView;
}

type Value = SnapshotChange['before'];

/** A snapshot value as text: codes by their code, enum values by their label, never an id. */
function useValueText(library: CodeLibraryPath) {
  const own = useCodeList(library, { includeRetired: true });
  const impacts = useCodeList('impact-codes', { includeRetired: true });
  return (key: string, value: Value): string => {
    if (value === null || value === undefined || value === '') return '—';
    const text = String(value);
    if (key === 'parentId') return own.items.find((entry) => entry.id === text)?.code ?? 'Another code';
    if (key === 'defaults.impactCodeId') return impacts.items.find((entry) => entry.id === text)?.code ?? 'Another impact code';
    if (key === 'defaults.oeeComponent') return labelOf(OEE_COMPONENT_LABELS, text);
    if (key === 'defaults.scheduleClass') return labelOf(SCHEDULE_CLASS_LABELS, text);
    if (key === 'groupKind') return labelOf(FAILURE_GROUP_KIND_LABELS, text);
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return text;
  };
}

/** Version history of a code, newest first, 20 per page, each with what changed. */
export function CodeVersions({ library, code }: CodeVersionsProps) {
  const versions = useCodeVersions(library, code.id);
  const dates = usePlantDates();
  const show = useValueText(library);
  const entries = useMemo(() => versionTimeline(versions.data ?? []), [versions.data]);
  const columns: Array<DataTableColumn<VersionEntry>> = [
    { id: 'version', header: 'Version', nowrap: true, cell: (entry) => <span data-testid="code-version" data-version={entry.version}>Version {entry.version}</span> },
    { id: 'valid', header: 'Valid', nowrap: true, cell: (entry) => dates.validity(entry.effectiveFrom, entry.effectiveTo) },
    {
      id: 'changes',
      header: 'What changed',
      cell: (entry) =>
        entry.changes.length === 0 ? (
          <span className="text-muted-foreground">Only the validity changed.</span>
        ) : (
          <ul className="space-y-0.5 text-sm" data-version={entry.version}>
            {entry.changes.map((change) => (
              <li key={change.key} data-testid="version-change" data-key={change.key}>
                {snapshotLabel(change.key)}: <span className="text-muted-foreground line-through">{show(change.key, change.before)}</span> → {show(change.key, change.after)}
              </li>
            ))}
          </ul>
        ),
    },
  ];
  return (
    <DataTable
      caption={`Versions of ${code.code}`}
      columns={columns}
      rows={entries}
      getRowKey={(entry) => String(entry.version)}
      status={{ isLoading: versions.isLoading, isError: versions.isError, error: versions.error, onRetry: () => void versions.refetch() }}
      empty={{ title: 'No versions recorded yet', text: 'The first change records a baseline.' }}
    />
  );
}
