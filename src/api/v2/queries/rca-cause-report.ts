import { useQuery } from '@tanstack/react-query';
import { v2Request } from '../client';
import type { QueryParams } from '../request-url';
import type { RcaCauseReportQuery, RcaCauseReportView } from '../types/rca-cause-report';
import { sameTenantQuery } from './placeholder';
import { v2Keys } from './query-keys';
import { STALE_TIME } from './stale-times';
import { useV2TenantId } from './use-v2-tenant';

/**
 * Recurring causes (item 1.1, `GET /reports/rca-causes`): catalogue codes ranked on the server by the cases
 * of your scope naming them, with the approved loss of those cases. Keyed under the RCA cases so a case or
 * cause change refreshes it.
 */
export function useRcaCauseReport(query: RcaCauseReportQuery) {
  const tenantId = useV2TenantId();
  const enabled = Boolean(tenantId);
  return useQuery<RcaCauseReportView>({
    queryKey: v2Keys.list(tenantId ?? '-', 'rca-cases', { filters: { kind: 'cause-report', ...query } }),
    enabled,
    staleTime: STALE_TIME['rca-cases'],
    refetchOnWindowFocus: false,
    placeholderData: (previous, previousQuery) => (enabled && sameTenantQuery(tenantId, previousQuery) ? previous : undefined),
    queryFn: async ({ signal }) =>
      (await v2Request<RcaCauseReportView>({ method: 'GET', path: '/reports/rca-causes', query: query as QueryParams, signal })).data,
  });
}
