import { useQuery } from '@tanstack/react-query';
import { v2Request } from '@/api/v2/client';
import { v2Keys } from '@/api/v2/queries/query-keys';
import { STALE_TIME } from '@/api/v2/queries/stale-times';
import { usePagedQuery } from '@/api/v2/queries/use-paged-query';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import type { ProfileView } from '@/api/v2/types/profiles';

export interface ProfileListFilters {
  unitId: string;
  productId: string;
}

/** Profile versions, 20 per page (server keyset), filtered by unit and product on the server. */
export function usePagedProfiles({ unitId, productId }: ProfileListFilters) {
  const query = { ...(unitId ? { unitId } : {}), ...(productId ? { productId } : {}) };
  return usePagedQuery<ProfileView>({
    resource: 'profiles',
    path: '/profiles',
    query,
    key: { scope: unitId ? { unitIds: [unitId] } : null, filters: { kind: 'profiles', ...query } },
  });
}

/** One profile version (detail page); refreshed with every profile change (same resource prefix). */
export function useProfile(profileId: string | null) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.detail(tenantId ?? '-', 'profiles', profileId ?? '-', 'profile'),
    enabled: Boolean(tenantId && profileId),
    staleTime: STALE_TIME.profiles,
    queryFn: async ({ signal }) => (await v2Request<ProfileView>({ method: 'GET', path: `/profiles/${profileId}`, signal })).data,
  });
}
