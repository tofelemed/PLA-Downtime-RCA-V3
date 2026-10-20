import { useQuery } from '@tanstack/react-query';
import { v2Request } from '../client';
import type { ListResponse } from '../types/envelopes';
import type { RcaRecommendationView } from '../types/rca';
import { v2Keys } from './query-keys';
import { STALE_TIME } from './stale-times';
import { useV2TenantId } from './use-v2-tenant';

/** Trigger kind of the recurrence watch of closed cases (D-T3, backend `recurrence-watch.ts`). */
export const REEVALUATE_TRIGGER = 'reevaluate';
/** Watched closed cases with an open re-evaluate recommendation fit one page in practice. */
const PAGE = 100;

/**
 * Open "re-evaluate" recommendations (`GET /rca-recommendations?trigger=reevaluate&state=open`): of one
 * case when `rcaId` is given, else of the scope (for the list badges). Keyed under the recommendations so
 * a dismissal or a case change refreshes them.
 */
export function useReevaluateRecommendations(rcaId?: string, enabled = true) {
  const tenantId = useV2TenantId();
  const query = { state: 'open', trigger: REEVALUATE_TRIGGER, limit: PAGE, ...(rcaId ? { rcaId } : {}) };
  return useQuery({
    queryKey: v2Keys.list(tenantId ?? '-', 'rca-recommendations', { filters: query }),
    enabled: Boolean(tenantId) && enabled,
    staleTime: STALE_TIME['rca-recommendations'],
    queryFn: async ({ signal }) =>
      (await v2Request<ListResponse<RcaRecommendationView>>({ method: 'GET', path: '/rca-recommendations', query, signal })).data.items,
  });
}
