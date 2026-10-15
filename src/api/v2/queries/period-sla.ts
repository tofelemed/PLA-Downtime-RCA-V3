import { useQuery } from '@tanstack/react-query';
import { v2Request } from '../client';
import type { DataHoldKind, PeriodSlaDetailView, QueueItemView } from '../types/period-sla';
import { v2Keys } from './query-keys';
import { STALE_TIME } from './stale-times';
import { usePagedQuery } from './use-paged-query';
import { useV2Command } from './use-v2-command';
import { useV2TenantId } from './use-v2-tenant';

/** Due times, overdue, escalation, holds and the latest rejection of one period (SME R3 / R6). */
export function usePeriodSla(periodId: string | null) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.detail(tenantId ?? '-', 'close', periodId ?? '-', 'period-sla'),
    enabled: Boolean(tenantId && periodId),
    staleTime: STALE_TIME.close,
    queryFn: async ({ signal }) => (await v2Request<PeriodSlaDetailView>({ method: 'GET', path: `/production-periods/${periodId}/sla`, signal })).data,
  });
}

export interface DataHoldInput {
  periodId: string;
  /** true: start waiting (kind and reason required by the server); false: the data arrived */
  open: boolean;
  kind?: DataHoldKind;
  reason?: string;
  note?: string;
}

/** "Waiting for data": open a hold (the clocks pause) or release it; the period, the grid and the queue refresh. */
export function useDataHoldCommand() {
  const tenantId = useV2TenantId();
  return useV2Command<DataHoldInput, PeriodSlaDetailView>({
    run: async ({ input, idempotencyKey }) => {
      const base = `/production-periods/${input.periodId}/data-holds`;
      if (input.open) return (await v2Request<PeriodSlaDetailView>({ method: 'POST', path: base, body: { kind: input.kind, reason: input.reason }, idempotencyKey })).data;
      const body = input.note ? { note: input.note } : {};
      return (await v2Request<PeriodSlaDetailView>({ method: 'POST', path: `${base}/release`, body, idempotencyKey })).data;
    },
    changes: (input) => (tenantId ? { tenantId, entityType: 'production_period', entityId: input.periodId, window: null } : null),
    retries: 0,
  });
}

/** "My queue": the periods the signed-in user should prepare, review or handle as an escalation, earliest due first. */
export function useReconciliationQueue() {
  return usePagedQuery<QueueItemView>({
    resource: 'close',
    path: '/reconciliation-queue',
    query: {},
    key: { filters: { kind: 'reconciliation-queue' } },
  });
}
