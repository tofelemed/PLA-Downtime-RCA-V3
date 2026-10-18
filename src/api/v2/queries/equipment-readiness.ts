import { useQuery } from '@tanstack/react-query';
import type { QueryOf } from '../schema-types';
import type { EquipmentReadinessView } from '../types/equipment-readiness';
import { v2 } from '../v2';
import { v2Keys } from './query-keys';
import { useV2TenantId } from './use-v2-tenant';

export type EquipmentReadinessQuery = QueryOf<'/api/v2/equipment-setup/readiness', 'get'>;
/** One bounded server snapshot; refreshed on return/focus and every minute while this page is visible. */
export function useEquipmentReadiness(query: EquipmentReadinessQuery | null) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.list(tenantId ?? '-', 'master-data', { scope: { unitIds: query ? [query.unitId] : [] }, window: query, filters: { kind: 'equipment-readiness', ...query } }),
    enabled: Boolean(tenantId && query),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    retry: 1,
    queryFn: async ({ signal }) => (await v2.get<EquipmentReadinessView, '/api/v2/equipment-setup/readiness'>('/api/v2/equipment-setup/readiness', { query: query!, signal })).data,
  });
}
