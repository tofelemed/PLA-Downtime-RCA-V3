import type { ApprovalItem } from '@/api/v2/types/approvals';
import { Badge } from '@/components/ui/badge';
import { useCapabilities } from '@/features/auth/use-capabilities';
/** The required workflow role is descriptive; SuperAdmin already satisfies all server approval roles. */
export function ApprovalStateCell({ item }: { item: ApprovalItem }) {
  const { isSuperAdmin } = useCapabilities();
  return <div className="space-y-1">
    <Badge variant="secondary">{item.state.replace(/_/g, ' ')}</Badge>
    <p className="text-xs text-muted-foreground">{item.requiredRoles.map((role) => role.replace(/_/g, ' ')).join(' / ')}</p>
    {isSuperAdmin && <p className="text-xs font-medium text-primary">SuperAdmin can act for every approval role</p>}
  </div>;
}
