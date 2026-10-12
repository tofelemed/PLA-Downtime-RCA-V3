import { useMemo } from 'react';
import { useV1Directory } from '@/features/ux-kit/labels/directory-query';
import { masterDataApi } from '@/services/api/masterDataApi';

const fetchAssets = () => masterDataApi.getAssets();

/** Assets of the plant as select options (the directory the asset name resolver reads; shared cache). */
export function useAssetOptions(): Array<{ value: string; label: string }> {
  const query = useV1Directory(['assets'], fetchAssets);
  return useMemo(
    () => (Array.isArray(query.data) ? query.data : []).filter((asset) => asset.name).map((asset) => ({ value: asset.id, label: asset.name ?? '' })),
    [query.data],
  );
}
