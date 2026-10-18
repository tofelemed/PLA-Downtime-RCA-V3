import { useQuery } from '@tanstack/react-query';
import { v2Request } from '@/api/v2/client';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import type { ApprovalItem } from '@/api/v2/types/approvals';
export function useApprovalRecord(item: ApprovalItem, open: boolean) {
  const tenantId = useV2TenantId();
  // Source-status matrices are reviewed in their existing owner workspace.
  const supported = Boolean(item.resource && item.resource !== 'source-status-mappings');
  const query = useQuery({ queryKey: ['v2', tenantId, 'approval-review', item.kind, item.id], enabled: open && supported,
    staleTime: 0, refetchOnMount: 'always', retry: false,
    queryFn: async ({ signal }) => (await v2Request<unknown>({ method: 'GET', path: `/${item.resource}/${item.commandId}`, signal })).data,
  });
  return { ...query, supported };
}
/** A changed draft must be refreshed before the reviewed command can be sent. */
export function approvalRecordChanged(item: ApprovalItem, value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  const version = item.kind === 'plan' && record.version && typeof record.version === 'object' ? record.version as Record<string, unknown> : record;
  return typeof version.rowVersion === 'number' && version.rowVersion !== item.rowVersion;
}
