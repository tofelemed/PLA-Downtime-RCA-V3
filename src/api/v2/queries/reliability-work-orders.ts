import { useQuery } from '@tanstack/react-query';
import { v2Request } from '../client';
import type { RepairEvidenceView, WorkOrderImportResult, WorkOrderOperationRow, WorkOrderOperationView } from '../types/reliability';
import { v2Keys } from './query-keys';
import { STALE_TIME } from './stale-times';
import { usePagedQuery } from './use-paged-query';
import { useV2Command } from './use-v2-command';
import { useV2TenantId } from './use-v2-tenant';

/** Server-side filters of `GET /v2/work-order-operations` (never applied in the browser). */
export interface WorkOrderFilters {
  eventId?: string;
  assetId?: string;
}

/** SME D10: CMMS operations of the caller's scope, per stop or asset (keyset on startedAt). */
export function useWorkOrderOperationsPage(filters: WorkOrderFilters) {
  const query = {
    eventIds: filters.eventId ? [filters.eventId] : undefined,
    assetIds: filters.assetId ? [filters.assetId] : undefined,
  };
  return usePagedQuery<WorkOrderOperationView>({
    resource: 'reliability',
    path: '/work-order-operations',
    query,
    key: { filters: { workOrderOperations: true, ...filters } },
  });
}

/** The stop's active repair vs waiting, as the server counts it for "Mean active repair time". */
export function useRepairEvidence(eventId: string | null) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.detail(tenantId ?? '-', 'reliability', eventId ?? '-', 'repair-evidence'),
    enabled: Boolean(tenantId && eventId),
    staleTime: STALE_TIME.reliability,
    queryFn: async ({ signal }) =>
      (await v2Request<RepairEvidenceView>({ method: 'GET', path: '/work-order-operations/repair-evidence', query: { eventId }, signal })).data,
  });
}

/** Upsert on work order + operation, all or nothing (422 WORK_ORDER_IMPORT_INVALID with row problems). */
export function useImportWorkOrderOperations() {
  const tenantId = useV2TenantId();
  return useV2Command<WorkOrderOperationRow[], WorkOrderImportResult>({
    run: async ({ input, idempotencyKey }) =>
      (await v2Request<WorkOrderImportResult>({ method: 'POST', path: '/work-order-operations/import', body: { operations: input }, idempotencyKey })).data,
    // the KPI run reads the operations: mean active repair time of the linked stops' periods
    changes: () => (tenantId ? [{ tenantId, entityType: 'reliability' }, { tenantId, entityType: 'production_period' }] : null),
  });
}
