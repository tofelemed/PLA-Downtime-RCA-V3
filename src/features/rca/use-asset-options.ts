import { useMemo } from 'react';
import { useAssetDirectory } from '@/api/v2/queries/assets';

/** Active assets of the plant as select options, by name (the v2 asset directory, FE-09; shared cache). */
export function useAssetOptions(): Array<{ value: string; label: string }> {
  const { assets } = useAssetDirectory();
  return useMemo(
    () => assets.filter((asset) => asset.retiredAt === null && asset.name).map((asset) => ({ value: asset.id, label: asset.name })),
    [assets],
  );
}
