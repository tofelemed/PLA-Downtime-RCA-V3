import { useMemo } from 'react';
import { useCodeVersions } from '@/api/v2/queries/codes-admin';
import type { CodeDetailView, CodeLibraryPath } from '@/api/v2/types/codes-admin';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { snapshotLabel, versionTimeline } from '../model/version-diff';

export interface CodeVersionsProps {
  library: CodeLibraryPath;
  code: CodeDetailView;
  codes: readonly CodeDetailView[];
  timezone: string;
}

type Value = string | number | boolean | null | undefined;

/** Version history of a code, newest first, each with what changed (parents shown by code). */
export function CodeVersions({ library, code, codes, timezone }: CodeVersionsProps) {
  const versions = useCodeVersions(library, code.id);
  const entries = useMemo(() => versionTimeline(versions.data ?? []), [versions.data]);
  const show = (key: string, value: Value) => {
    if (value === null || value === undefined || value === '') return '—';
    if (key === 'parentId' || key === 'defaults.impactCodeId') return codes.find((entry) => entry.id === value)?.code ?? String(value);
    return String(value);
  };
  return (
    <DataState state={dataStateOf(versions, { isEmpty: entries.length === 0 })} error={versions.error} detail="No versions recorded yet (the first change records a baseline).">
      <ol className="space-y-2" data-testid="code-versions">
        {entries.map((entry) => (
          <li key={entry.version} className="rounded border p-2 text-sm" data-testid="code-version" data-version={entry.version}>
            <p className="font-medium">
              Version {entry.version} · from <PlantTime iso={entry.effectiveFrom} tz={timezone} withDate />
              {entry.effectiveTo && (
                <>
                  {' '}
                  to <PlantTime iso={entry.effectiveTo} tz={timezone} withDate />
                </>
              )}
            </p>
            <ul className="mt-1 space-y-0.5 text-xs">
              {entry.changes.map((change) => (
                <li key={change.key} data-testid="version-change" data-key={change.key}>
                  {snapshotLabel(change.key)}: <span className="line-through text-muted-foreground">{show(change.key, change.before)}</span> → <span>{show(change.key, change.after)}</span>
                </li>
              ))}
              {entry.changes.length === 0 && <li className="text-muted-foreground">No field changes (validity only).</li>}
            </ul>
          </li>
        ))}
      </ol>
    </DataState>
  );
}
