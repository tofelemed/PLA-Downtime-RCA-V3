import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { removeDecidedApproval } from './approval-inbox-cache';
import { v2Request } from '../client';
import type { ApprovalItem } from '../types/approvals';
import { usePagedQuery } from './use-paged-query';
import { useV2Command } from './use-v2-command';
import { useV2TenantId } from './use-v2-tenant';
import { approvalCommand, type ApprovalDecision } from '@/features/approvals/approval-command';

export function useApprovalInbox(kind?: string) {
  const inbox = usePagedQuery<ApprovalItem>({ resource: 'close', path: '/approval-inbox', query: { kind }, key: { filters: { kind: 'approval-inbox', workflow: kind } }, refetchInterval: 60_000 });
  const { pageIndex, first } = inbox.pager;
  const empty = inbox.rows.length === 0;
  useEffect(() => { if (pageIndex > 0 && empty) first(); }, [pageIndex, empty, first]);
  return inbox;
}
export function useApprovalDecision() {
  const tenantId = useV2TenantId();
  const client = useQueryClient();
  return useV2Command<ApprovalDecision, unknown>({
    run: async ({ input, idempotencyKey }) => {
      const result = await v2Request<unknown>({ method: 'POST', ...approvalCommand(input), idempotencyKey });
      if (tenantId) await removeDecidedApproval(client, tenantId, input.item);
      return result.data;
    },
    changes: () => tenantId ? { tenantId, entityType: 'approval_decision', window: null } : null,
    retries: 0,
  });
}
