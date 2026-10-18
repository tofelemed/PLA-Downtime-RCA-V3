import type { ApprovalItem } from '@/api/v2/types/approvals';
import type { DataTableColumn } from '@/features/ux-kit/data-table';
import { resolvedActorText } from '@/features/ux-kit/labels';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { RecordCell, RowActions } from './approval-row-cells';
import { ApprovalStateCell } from './approval-state-cell';

/** Inbox columns: what changes, scope and requester, age, state and role, and the decision. */
export function approvalColumns(timezone: string): DataTableColumn<ApprovalItem>[] {
  return [
    { id: 'record', header: 'What needs approval', cell: (item) => <RecordCell item={item} /> },
    { id: 'scope', header: 'Unit / requested by', cell: (item) => <div>{item.unitName ?? 'Plant-wide'}<p className="text-xs text-muted-foreground">{resolvedActorText(item.authorId, item.authorName)}</p></div> },
    { id: 'created', header: 'Created', cell: (item) => <PlantTime iso={item.createdAt} tz={timezone} withDate /> },
    { id: 'state', header: 'State / required approval role', cell: (item) => <ApprovalStateCell item={item} /> },
    { id: 'actions', header: 'Decide', cell: (item) => <RowActions item={item} /> },
  ];
}
