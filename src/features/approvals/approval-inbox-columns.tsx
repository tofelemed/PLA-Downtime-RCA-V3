import type { ApprovalItem } from '@/api/v2/types/approvals';
import type { DataTableColumn } from '@/features/ux-kit/data-table';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { RecordCell, RowActions } from './approval-row-cells';
import { ApprovalStateCell } from './approval-state-cell';

/** Inbox columns: what changes, unit, created (plant time; the header shows the timezone), state, and the decision. */
export function approvalColumns(timezone: string): DataTableColumn<ApprovalItem>[] {
  return [
    { id: 'record', header: 'What needs approval', cell: (item) => <RecordCell item={item} /> },
    { id: 'scope', header: 'Unit', cell: (item) => item.unitName ?? 'Plant-wide' },
    { id: 'created', header: 'Created', cell: (item) => <PlantTime iso={item.createdAt} tz={timezone} withDate withZone={false} /> },
    { id: 'state', header: 'State', cell: (item) => <ApprovalStateCell item={item} /> },
    { id: 'actions', header: 'Decide', cell: (item) => <RowActions item={item} /> },
  ];
}
