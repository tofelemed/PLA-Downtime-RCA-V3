import type { ApprovalItem } from '@/api/v2/types/approvals';
import { DataTable } from '@/features/ux-kit/data-table';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { approvalColumns } from './approval-inbox-columns';

interface ApprovalGroup {
  kind: string;
  label: string;
  items: ApprovalItem[];
}

/** Rows of the page grouped by workflow, groups in the order their oldest record waits (the page is oldest first). */
function groupApprovals(rows: readonly ApprovalItem[]): ApprovalGroup[] {
  const groups = new Map<string, ApprovalGroup>();
  rows.forEach((item) => {
    const group = groups.get(item.kind) ?? { kind: item.kind, label: item.kindLabel, items: [] };
    group.items.push(item);
    groups.set(item.kind, group);
  });
  return [...groups.values()];
}

/** One compact table per workflow on the current page; the pager below the groups pages the whole inbox. */
export function ApprovalInboxGroups({ rows, timezone }: { rows: readonly ApprovalItem[]; timezone: string }) {
  const { number } = useNumberFormat();
  const columns = approvalColumns(timezone);
  return (
    <div className="space-y-6" data-testid="approval-groups">
      {groupApprovals(rows).map((group) => (
        <section key={group.kind} aria-labelledby={`approval-group-${group.kind}`} data-testid="approval-group" data-kind={group.kind}>
          <h2 id={`approval-group-${group.kind}`} className="mb-2 text-base font-semibold">
            {group.label} <span className="font-normal text-muted-foreground">({number(group.items.length)})</span>
          </h2>
          <DataTable caption={`Pending ${group.label}`} columns={columns} rows={group.items} getRowKey={(item) => `${item.kind}:${item.id}`} pager="none" density="compact" />
        </section>
      ))}
    </div>
  );
}
