import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { removeDecidedApproval } from './approval-inbox-cache';
import { v2Request } from '../client';
import type { ApprovalItem } from '../types/approvals';
import type { ChangeNotice } from './invalidation';
import { usePagedQuery } from './use-paged-query';
import { useV2Command } from './use-v2-command';
import { useV2TenantId } from './use-v2-tenant';
import { approvalCommand, type ApprovalDecision } from '@/features/approvals/approval-command';

/** `decidable`: only records the caller may decide (filtered on the server, so pages stay complete). */
export function useApprovalInbox(kind?: string, decidable = false) {
  const only = decidable ? 'true' : undefined;
  const inbox = usePagedQuery<ApprovalItem>({ resource: 'close', path: '/approval-inbox', query: { kind, decidable: only }, key: { filters: { kind: 'approval-inbox', workflow: kind, decidable: only } }, refetchInterval: 60_000 });
  const { pageIndex, first } = inbox.pager;
  const empty = inbox.rows.length === 0;
  useEffect(() => { if (pageIndex > 0 && empty) first(); }, [pageIndex, empty, first]);
  return inbox;
}
/** A loss accounting decision also refreshes the plant settings and the periods it re-accounts (what `useDecideLossAccountingVersion` does). */
const LOSS_ACCOUNTING_RESOURCE = 'loss-accounting/versions';
export function useApprovalDecision() {
  const tenantId = useV2TenantId();
  const client = useQueryClient();
  return useV2Command<ApprovalDecision, unknown>({
    run: async ({ input, idempotencyKey }) => {
      const result = await v2Request<unknown>({ method: 'POST', ...approvalCommand(input), idempotencyKey });
      if (tenantId) await removeDecidedApproval(client, tenantId, input.item);
      return result.data;
    },
    changes: (input) => {
      if (!tenantId) return null;
      const decision: ChangeNotice = { tenantId, entityType: 'approval_decision', window: null };
      return input.item.resource === LOSS_ACCOUNTING_RESOURCE ? [decision, { tenantId, entityType: 'loss_accounting' }] : decision;
    },
    retries: 0,
  });
}
