import { useQuery } from '@tanstack/react-query';
import { v2Request } from '@/api/v2/client';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import type { ApprovalChanges, ApprovalItem } from '@/api/v2/types/approvals';

/** The query key prefix of approval change reads (refreshed with the inbox after every workflow change). */
export const APPROVAL_CHANGES_KEY = 'approval-changes';

/**
 * What exactly needs approval (`GET /v2/approval-inbox/{kind}/{id}/changes`): every field of the pending
 * record against its approved / effective predecessor, or its full content without one. Always fresh.
 */
export function useApprovalChanges(item: Pick<ApprovalItem, 'kind' | 'id' | 'rowVersion'>) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: ['v2', tenantId, APPROVAL_CHANGES_KEY, item.kind, item.id, item.rowVersion],
    enabled: Boolean(tenantId),
    staleTime: 0,
    retry: false,
    queryFn: async ({ signal }) =>
      (await v2Request<ApprovalChanges>({ method: 'GET', path: `/approval-inbox/${encodeURIComponent(item.kind)}/${encodeURIComponent(item.id)}/changes`, signal })).data,
  });
}
