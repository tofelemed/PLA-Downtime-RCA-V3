import { useMemo } from 'react';
import { useAssetDirectory } from '@/api/v2/queries/assets';
import { useUnits } from '@/api/v2/queries/units';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import type { MappingTargetType } from '@/api/v2/types/integration-mappings';
import { codeNameLabel } from '@/features/ux-kit/format/code-name';

/** Units or active assets (both v2, FE-09) a mapping rule can point at. */
export function useMappingTargets(targetType: MappingTargetType): { options: Array<{ value: string; label: string }>; isLoading: boolean } {
  const units = useUnits();
  const assets = useAssetDirectory();
  return useMemo(() => {
    if (targetType === 'asset') {
      const options = assets.assets.filter((asset) => asset.retiredAt === null).map((asset) => ({ value: asset.id, label: asset.name }));
      return { options, isLoading: assets.isLoading };
    }
    const options = flattenPages(units.data?.pages).map((unit) => ({ value: unit.id, label: codeNameLabel(unit) }));
    return { options, isLoading: units.isLoading };
  }, [targetType, units.data, units.isLoading, assets.assets, assets.isLoading]);
}
