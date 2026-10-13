import { useAssetDirectory } from '@/api/v2/queries/assets';
import { useNameResolver, type NameResolver } from './name-resolver';

/** Asset names of the acting plant from the v2 asset directory (FE-09); fallback "Unknown asset". */
export function useAssetNames(): NameResolver {
  const directory = useAssetDirectory();
  return useNameResolver(directory.assets, directory.isLoading, 'Unknown asset');
}
