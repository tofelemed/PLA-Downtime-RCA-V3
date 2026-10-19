import type { ApprovalItem } from '@/api/v2/types/approvals';
import { Badge } from '@/components/ui/badge';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { humanize, roleLabel } from '@/features/ux-kit/labels';

/** QA_SHELL: sentence-case state ("Awaiting posting") and role names ("Finance approver"), like other badges. */
export function approvalStateText(item: Pick<ApprovalItem, 'state' | 'requiredRoles'>): { state: string; roles: string } {
  return { state: humanize(item.state), roles: [...new Set(item.requiredRoles.map((role) => roleLabel(role)))].join(' / ') };
}

/** The required workflow role is descriptive; SuperAdmin already satisfies all server approval roles. */
export function ApprovalStateCell({ item }: { item: ApprovalItem }) {
  const { isSuperAdmin } = useCapabilities();
  const text = approvalStateText(item);
  return <div className="space-y-1">
    <Badge variant="secondary">{text.state}</Badge>
    <p className="text-xs text-muted-foreground">{text.roles}</p>
    {isSuperAdmin && <p className="text-xs font-medium text-primary">SuperAdmin can act for every approval role</p>}
  </div>;
}
