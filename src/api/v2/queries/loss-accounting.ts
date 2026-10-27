import { useQuery } from '@tanstack/react-query';
import { v2Request } from '../client';
import type { ListResponse } from '../types/envelopes';
import type {
  LossAccountingDecisionInput,
  LossAccountingDraftBody,
  LossAccountingInForceView,
  LossAccountingVersionView,
} from '../types/loss-accounting';
import { v2Keys } from './query-keys';
import { STALE_TIME } from './stale-times';
import { useV2Command } from './use-v2-command';
import { useV2TenantId } from './use-v2-tenant';

/** Most versions a unit lists (a handful of changes a year). */
const PAGE = 100;

/** The loss accounting version in force for a unit (its own, else plant-wide); absent = the plant-wide one. */
export function useLossAccountingInForce(unitId?: string | null) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.detail(tenantId ?? '-', 'loss-accounting', 'in-force', unitId ?? 'plant'),
    enabled: Boolean(tenantId),
    staleTime: STALE_TIME['loss-accounting'],
    queryFn: async ({ signal }) =>
      (await v2Request<LossAccountingInForceView>({ method: 'GET', path: '/loss-accounting', query: unitId ? { unitId } : {}, signal })).data,
  });
}

/** The unit's versions and the plant-wide ones, newest first: drafts, approved and rejected. */
export function useLossAccountingVersions(unitId?: string | null) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.list(tenantId ?? '-', 'loss-accounting', { scope: { unitIds: unitId ? [unitId] : [] } }),
    enabled: Boolean(tenantId),
    staleTime: STALE_TIME['loss-accounting'],
    queryFn: async ({ signal }) =>
      (
        await v2Request<ListResponse<LossAccountingVersionView>>({
          method: 'GET',
          path: '/loss-accounting/versions',
          query: unitId ? { unitId, includeTenantWide: true, limit: PAGE } : { limit: PAGE },
          signal,
        })
      ).data,
  });
}

/** Drafts a version from the one in force; it applies once production accounting approves it. */
export function useDraftLossAccountingVersion() {
  const tenantId = useV2TenantId();
  return useV2Command<LossAccountingDraftBody, LossAccountingVersionView>({
    run: async ({ input, idempotencyKey }) => (await v2Request<LossAccountingVersionView>({ method: 'POST', path: '/loss-accounting/versions', body: input, idempotencyKey })).data,
    changes: () => (tenantId ? { tenantId, entityType: 'loss_accounting' } : null),
    retries: 0,
  });
}

/** Production accounting approves or rejects a draft (never its author: 403 SEPARATION_OF_DUTIES). */
export function useDecideLossAccountingVersion() {
  const tenantId = useV2TenantId();
  return useV2Command<LossAccountingDecisionInput, LossAccountingVersionView>({
    run: async ({ input, idempotencyKey }) =>
      (await v2Request<LossAccountingVersionView>({ method: 'POST', path: `/loss-accounting/versions/${input.id}/${input.decision}`, body: input.reason ? { reason: input.reason } : {}, idempotencyKey })).data,
    changes: () => (tenantId ? { tenantId, entityType: 'loss_accounting' } : null),
    retries: 0,
  });
}
