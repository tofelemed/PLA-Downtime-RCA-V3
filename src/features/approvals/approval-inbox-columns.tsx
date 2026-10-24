import type { ApprovalItem } from '@/api/v2/types/approvals';
import type { DataTableColumn } from '@/features/ux-kit/data-table';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { RecordCell, RowActions } from './approval-row-cells';
import { ApprovalStateCell } from './approval-state-cell';

/** Inbox columns (fixed widths so every workflow group lines up): what changes, unit, created (plant time; the header shows the timezone), state, and the decision. */
export function approvalColumns(timezone: string): DataTableColumn<ApprovalItem>[] {
  return [
    { id: 'record', header: 'What needs approval', width: '38%', cell: (item) => <RecordCell item={item} /> },
    { id: 'scope', header: 'Unit', width: '14%', cell: (item) => item.unitName ?? 'Plant-wide' },
    { id: 'created', header: 'Created', width: '14%', cell: (item) => <PlantTime iso={item.createdAt} tz={timezone} withDate withZone={false} /> },
    { id: 'state', header: 'State', width: '12%', cell: (item) => <ApprovalStateCell item={item} /> },
    { id: 'actions', header: 'Decide', width: '22%', cell: (item) => <RowActions item={item} /> },
  ];
}
