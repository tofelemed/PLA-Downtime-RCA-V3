import type { CalendarVersionView } from '@/api/v2/types/calendars';
import { VersionStateBadge } from '../components/version-state-badge';

export interface CalendarVersionListProps {
  versions: readonly CalendarVersionView[];
  selectedId: string | null;
  onSelect: (version: CalendarVersionView) => void;
}

/** Versions of the chosen calendar scope with state and effective operational dates. */
export function CalendarVersionList({ versions, selectedId, onSelect }: CalendarVersionListProps) {
  return (
    <ul className="space-y-1" data-testid="calendar-versions">
      {versions.map((version) => (
        <li key={version.id}>
          <button
            type="button"
            className={`w-full rounded-md border p-2 text-left text-sm hover:bg-muted ${version.id === selectedId ? 'border-primary bg-muted' : ''}`}
            aria-pressed={version.id === selectedId}
            data-testid="calendar-version-row"
            data-version={version.version}
            onClick={() => onSelect(version)}
          >
            <span className="flex items-center justify-between">
              <span className="font-medium">
                v{version.version} · {version.timezone}
              </span>
              <VersionStateBadge state={version.state} />
            </span>
            <span className="block text-xs text-muted-foreground">
              {version.effectiveFrom} → {version.effectiveTo ?? 'open'} · {version.shiftTemplates.length} shifts
              {version.unitId ? ' · unit override' : ''}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
