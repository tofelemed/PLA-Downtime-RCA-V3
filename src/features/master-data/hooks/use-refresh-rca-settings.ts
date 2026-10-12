import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { invalidateForChange } from '@/api/v2/queries/invalidation';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';

/** Refreshes the RCA settings lists and the overview counts after a bulk change (import, bulk retire). */
export function useRefreshRcaSettings() {
  const tenantId = useV2TenantId();
  const queryClient = useQueryClient();
  return useCallback(async () => {
    if (tenantId) await invalidateForChange(queryClient, { tenantId, entityType: 'rca_settings' });
  }, [queryClient, tenantId]);
}
