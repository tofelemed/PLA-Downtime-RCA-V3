import type { CalendarVersionView } from '@/api/v2/types/calendars';
import { DataTable, type DataTableColumn, type DataTableStatus, type PagerModel } from '@/features/ux-kit/data-table';
import { formatOperationalDate, useCalendarPreference } from '@/lib/dates';
import { VersionStateBadge } from '@/features/ux-kit/version-state-badge';

export interface CalendarVersionListProps {
  /** the rows of the current page (`pager` given) or every version */
  versions: readonly CalendarVersionView[];
  /** the server pager of the list (`usePagedQuery`); without it the table pages the rows itself */
  pager?: PagerModel;
  status: DataTableStatus;
  onOpen: (version: CalendarVersionView) => void;
}

/**
 * Versions of the chosen calendar scope with state and effective operational dates (20 per page). Every row is
 * of the scope chosen above (site or one unit's override), so the scope is not repeated per row.
 */
export function CalendarVersionList({ versions, pager, status, onOpen }: CalendarVersionListProps) {
  const pref = useCalendarPreference();
  const columns: DataTableColumn<CalendarVersionView>[] = [
    { id: 'version', header: 'Version', nowrap: true, cell: (v) => <span data-testid="calendar-version-row" data-version={v.version}>Version {v.version}</span> },
    { id: 'zone', header: 'Time zone', cell: (v) => v.timezone },
    { id: 'from', header: 'Effective from', nowrap: true, cell: (v) => formatOperationalDate(v.effectiveFrom, pref) },
    { id: 'to', header: 'Effective to', nowrap: true, cell: (v) => (v.effectiveTo ? formatOperationalDate(v.effectiveTo, pref) : 'open-ended') },
    { id: 'shifts', header: 'Shifts', align: 'right', cell: (v) => v.shiftTemplates.length },
    { id: 'state', header: 'State', nowrap: true, cell: (v) => <VersionStateBadge state={v.state} /> },
  ];
  return (
    <div data-testid="calendar-versions">
      <DataTable
        caption="Calendar versions"
        columns={columns}
        rows={versions}
        getRowKey={(v) => v.id}
        pager={pager}
        status={status}
        empty={{ title: 'No calendar versions', text: 'No calendar versions for this calendar yet.' }}
        onRowClick={onOpen}
        rowLabel={(v) => `Open calendar version ${v.version}`}
      />
    </div>
  );
}
