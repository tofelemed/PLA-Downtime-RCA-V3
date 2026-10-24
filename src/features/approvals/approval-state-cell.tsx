import type { ApprovalItem } from '@/api/v2/types/approvals';
import { Badge } from '@/components/ui/badge';
import { humanize, roleLabel } from '@/features/ux-kit/labels';

/** QA_SHELL: sentence-case state ("Awaiting posting") and role names ("Finance approver"), like other badges. */
export function approvalStateText(item: Pick<ApprovalItem, 'state' | 'requiredRoles'>): { state: string; roles: string } {
  return { state: humanize(item.state), roles: [...new Set(item.requiredRoles.map((role) => roleLabel(role)))].join(' / ') };
}

/** The inbox shows the workflow state only; the required role and SuperAdmin note are on the approval page. */
export function ApprovalStateCell({ item }: { item: ApprovalItem }) {
  return <Badge variant="secondary" className="whitespace-nowrap">{approvalStateText(item).state}</Badge>;
}
