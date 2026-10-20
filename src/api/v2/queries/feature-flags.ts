import { useQuery } from '@tanstack/react-query';
import { v2 } from '../v2';
import type { FeatureFlagKey, FeatureFlagState, FeatureFlagsView } from '../types/flags';
import { v2Keys } from './query-keys';
import { fromSessionBootstrap } from './session-bootstrap';
import { STALE_TIME } from './stale-times';
import { useV2Command } from './use-v2-command';
import { useV2TenantId } from './use-v2-tenant';

/** Server-side flags of the acting tenant (plan 3.1 step 5). */
export function useFeatureFlags() {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.list(tenantId ?? '-', 'feature-flags'),
    enabled: Boolean(tenantId),
    staleTime: STALE_TIME['feature-flags'],
    queryFn: ({ signal }) =>
      fromSessionBootstrap('featureFlags', async () =>
        (await v2.get<FeatureFlagsView, '/api/v2/feature-flags'>('/api/v2/feature-flags', { signal })).data),
  });
}

export interface FlagState {
  enabled: boolean;
  /** true until the flags are known: render nothing (or a skeleton) instead of guessing v1/v2 */
  loading: boolean;
}

/** One flag; unknown or unreachable flags count as off, so v1 stays the default (decision C4). */
export function useFlag(key: FeatureFlagKey): FlagState {
  const { data, isLoading } = useFeatureFlags();
  const item = data?.items.find((flag) => flag.key === key);
  return { enabled: item?.enabled === true, loading: isLoading };
}

/** Switch a flag for the tenant (manager with a tenant-wide grant). */
export function useSetFeatureFlag() {
  const tenantId = useV2TenantId();
  return useV2Command<{ key: FeatureFlagKey; enabled: boolean }, FeatureFlagState>({
    run: async ({ input }) =>
      (await v2.put<FeatureFlagState, '/api/v2/feature-flags/{key}'>('/api/v2/feature-flags/{key}', {
        path: { key: input.key },
        body: { enabled: input.enabled },
      })).data,
    changes: () => (tenantId ? { tenantId, entityType: 'feature_flag' } : null),
  });
}
