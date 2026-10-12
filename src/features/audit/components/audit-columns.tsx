import type { AuditEntryView } from '@/api/v2/types/administration';
import { Badge } from '@/components/ui/badge';
import type { DataTableColumn } from '@/features/ux-kit/data-table';
import { AUDIT_ACTION_LABELS, AUDIT_ENTITY_LABELS, labelOf } from '@/features/ux-kit/labels';
import { UiIcon } from '@/lib/icons';

/** The action word of an entry (`CREATE` → "Created"; client actions like `UPDATE_USER` → "User changed"). */
export const actionLabel = (action: string) => labelOf(AUDIT_ACTION_LABELS, action);
export const entityLabel = (entityType: string) => labelOf(AUDIT_ENTITY_LABELS, entityType);

/** Columns of the audit table: time, who, what, record type, summary (no ids: those are on the detail page). */
export function auditColumns(formatDateTime: (iso: string) => string): ReadonlyArray<DataTableColumn<AuditEntryView>> {
  return [
    { id: 'time', header: 'Time', cell: (entry) => formatDateTime(entry.timestamp), nowrap: true },
    { id: 'user', header: 'User', cell: (entry) => entry.actorName ?? 'Unknown user' },
    { id: 'action', header: 'Action', cell: (entry) => <Badge variant="outline">{actionLabel(entry.action)}</Badge>, nowrap: true },
    { id: 'entity', header: 'Record', cell: (entry) => entityLabel(entry.entityType) },
    {
      id: 'summary',
      header: 'Summary',
      cell: (entry) => <span className="line-clamp-1 max-w-md text-xs text-muted-foreground">{entry.message ?? '—'}</span>,
    },
    {
      id: 'open',
      header: <span className="sr-only">Open</span>,
      headerLabel: 'Open',
      cell: () => <UiIcon.next aria-hidden="true" className="h-4 w-4 text-muted-foreground" />,
      width: '2.5rem',
    },
  ];
}
