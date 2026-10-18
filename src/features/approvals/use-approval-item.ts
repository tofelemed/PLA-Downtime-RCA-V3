import { useQuery } from '@tanstack/react-query';
import { v2Request } from '@/api/v2/client';
import { V2ApiError } from '@/api/v2/errors';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import type { ApprovalItem } from '@/api/v2/types/approvals';

/** The query key prefix of approval detail reads (removed when a decision is confirmed). */
export const APPROVAL_ITEM_KEY = 'approval-item';

/**
 * One pending record of the caller's approval inbox (`GET /v2/approval-inbox/{kind}/{id}`): the same row,
 * role / scope filter and separation-of-duties actions as the list. Always read fresh — a record decided by
 * someone else answers 404 (`isGone`).
 */
export function useApprovalItem(kind: string, id: string) {
  const tenantId = useV2TenantId();
  const query = useQuery({
    queryKey: ['v2', tenantId, APPROVAL_ITEM_KEY, kind, id],
    enabled: Boolean(tenantId && kind && id),
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
    queryFn: async ({ signal }) =>
      (await v2Request<ApprovalItem>({ method: 'GET', path: `/approval-inbox/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`, signal })).data,
  });
  const isGone = query.error instanceof V2ApiError && query.error.status === 404;
  return { ...query, isGone };
}
