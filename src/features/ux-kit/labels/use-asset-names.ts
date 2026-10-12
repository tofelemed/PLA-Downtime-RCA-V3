import { masterDataApi } from '@/services/api/masterDataApi';
import { useV1Directory } from './directory-query';
import { useNameResolver, type NameResolver } from './name-resolver';

const fetchAssets = () => masterDataApi.getAssets();

/**
 * Asset names of the acting plant. The v2 API has no asset list yet, so this reads v1 `GET /assets` (any
 * member, tenant from `X-Tenant-Id`) once per tenant; fallback "Unknown asset".
 */
export function useAssetNames(): NameResolver {
  const query = useV1Directory(['assets'], fetchAssets);
  return useNameResolver(query.data, query.isLoading, 'Unknown asset');
}
