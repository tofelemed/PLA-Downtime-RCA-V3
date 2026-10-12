import type { CalendarVersionView } from '@/api/v2/types/calendars';
import { DataTable, type DataTableColumn, type DataTableStatus } from '@/features/ux-kit/data-table';
import { formatOperationalDate, useCalendarPreference } from '@/lib/dates';
import { VersionStateBadge } from '../components/version-state-badge';

export interface CalendarVersionListProps {
  versions: readonly CalendarVersionView[];
  status: DataTableStatus;
  onOpen: (version: CalendarVersionView) => void;
}

/** Versions of the chosen calendar scope with state and effective operational dates (20 per page). */
export function CalendarVersionList({ versions, status, onOpen }: CalendarVersionListProps) {
  const pref = useCalendarPreference();
  const columns: DataTableColumn<CalendarVersionView>[] = [
    { id: 'version', header: 'Version', nowrap: true, cell: (v) => <span data-testid="calendar-version-row" data-version={v.version}>Version {v.version}</span> },
    { id: 'scope', header: 'Applies to', cell: (v) => (v.unitId ? 'Unit override' : 'Site calendar') },
    { id: 'zone', header: 'Time zone', cell: (v) => v.timezone },
    { id: 'from', header: 'Effective from', nowrap: true, cell: (v) => formatOperationalDate(v.effectiveFrom, pref) },
    { id: 'to', header: 'Effective to', nowrap: true, cell: (v) => (v.effectiveTo ? formatOperationalDate(v.effectiveTo, pref) : 'open-ended') },
    { id: 'shifts', header: 'Shifts', align: 'right', cell: (v) => String(v.shiftTemplates.length) },
    { id: 'state', header: 'State', cell: (v) => <VersionStateBadge state={v.state} /> },
  ];
  return (
    <div data-testid="calendar-versions">
      <DataTable
        caption="Calendar versions"
        columns={columns}
        rows={versions}
        getRowKey={(v) => v.id}
        status={status}
        empty={{ text: 'No calendar versions for this scope yet.' }}
        onRowClick={onOpen}
        rowLabel={(v) => `Open calendar version ${v.version}`}
      />
    </div>
  );
}
