import { useMemo } from 'react';
import { useUnits } from '@/api/v2/queries/units';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import type { MappingTargetType } from '@/api/v2/types/integration-mappings';
import { useV1Directory } from '@/features/ux-kit/labels/directory-query';
import { masterDataApi } from '@/services/api/masterDataApi';

const fetchAssets = () => masterDataApi.getAssets();

/** Units (v2) or assets (the shared v1 asset directory, no v2 list yet) a mapping rule can point at. */
export function useMappingTargets(targetType: MappingTargetType): { options: Array<{ value: string; label: string }>; isLoading: boolean } {
  const units = useUnits();
  const assets = useV1Directory(['assets'], fetchAssets);
  return useMemo(() => {
    if (targetType === 'asset') {
      const options = (assets.data ?? []).map((asset) => ({ value: asset.id, label: asset.name }));
      return { options, isLoading: assets.isLoading };
    }
    const options = flattenPages(units.data?.pages).map((unit) => ({ value: unit.id, label: `${unit.name} (${unit.code})` }));
    return { options, isLoading: units.isLoading };
  }, [targetType, units.data, units.isLoading, assets.data, assets.isLoading]);
}
