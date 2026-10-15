import { useQuery } from '@tanstack/react-query';
import { v2Request } from '../client';
import type {
  StandbyEquipmentBody,
  StandbyEquipmentView,
  StandbyImportResult,
  StandbyMetricsView,
  StandbyRecordRow,
  StandbyRecordView,
} from '../types/reliability';
import { v2Keys } from './query-keys';
import { STALE_TIME } from './stale-times';
import { usePagedQuery } from './use-paged-query';
import { useV2Command } from './use-v2-command';
import { useV2TenantId } from './use-v2-tenant';

export interface StandbyWindow {
  from: string;
  to: string;
}

/** SME D9: standby registrations of the caller's scope (keyset pages of 20). */
export function useStandbyEquipmentPage() {
  return usePagedQuery<StandbyEquipmentView>({
    resource: 'reliability',
    path: '/standby-equipment',
    query: {},
    key: { filters: { standbyEquipment: true } },
  });
}

/** Demand / test / running log entries overlapping a window (keyset on startedAt). */
export function useStandbyRecordsPage(window: StandbyWindow) {
  return usePagedQuery<StandbyRecordView>({
    resource: 'reliability',
    path: '/standby-records',
    query: { from: window.from, to: window.to },
    key: { window, filters: { standbyRecords: true } },
  });
}

/** Failure on demand, test failures, operating MTBF and exposure per standby asset, as the server computed them. */
export function useStandbyMetrics(window: StandbyWindow) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.list(tenantId ?? '-', 'reliability', { window, filters: { standbyMetrics: true } }),
    enabled: Boolean(tenantId),
    staleTime: STALE_TIME.reliability,
    queryFn: async ({ signal }) =>
      (await v2Request<StandbyMetricsView[]>({ method: 'GET', path: '/standby-equipment/metrics', query: { ...window }, signal })).data,
  });
}

function useStandbyCommand<TInput, TResult>(run: (input: TInput, idempotencyKey: string) => Promise<TResult>) {
  const tenantId = useV2TenantId();
  return useV2Command<TInput, TResult>({
    run: ({ input, idempotencyKey }) => run(input, idempotencyKey),
    changes: () => (tenantId ? { tenantId, entityType: 'reliability' } : null),
  });
}

export function useRegisterStandby() {
  return useStandbyCommand<StandbyEquipmentBody, StandbyEquipmentView>(async (body, idempotencyKey) =>
    (await v2Request<StandbyEquipmentView>({ method: 'POST', path: '/standby-equipment', body, idempotencyKey })).data,
  );
}

export function useRetireStandby() {
  return useStandbyCommand<string, StandbyEquipmentView>(async (id, idempotencyKey) =>
    (await v2Request<StandbyEquipmentView>({ method: 'POST', path: `/standby-equipment/${id}/retire`, body: {}, idempotencyKey })).data,
  );
}

/** All or nothing: 422 STANDBY_IMPORT_INVALID lists the row problems (`details.errors`). */
export function useImportStandbyRecords() {
  return useStandbyCommand<StandbyRecordRow[], StandbyImportResult>(async (records, idempotencyKey) =>
    (await v2Request<StandbyImportResult>({ method: 'POST', path: '/standby-records/import', body: { records }, idempotencyKey })).data,
  );
}
