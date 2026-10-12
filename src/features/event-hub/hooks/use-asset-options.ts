import { useMemo } from 'react';
import { useV1Directory } from '@/features/ux-kit/labels/directory-query';
import { masterDataApi } from '@/services/api/masterDataApi';
import type { CheckOption } from '../components/multi-check-select';

const fetchAssets = () => masterDataApi.getAssets();

/**
 * Asset filter choices: the plant's asset directory (the same cached list the asset name resolver
 * reads; v2 has no asset list yet), limited to the chosen units, sorted by name.
 */
export function useAssetOptions(unitIds: readonly string[]): CheckOption[] {
  const query = useV1Directory(['assets'], fetchAssets);
  return useMemo(() => {
    const units = new Set(unitIds);
    return (query.data ?? [])
      .filter((asset) => units.size === 0 || units.has(asset.unitId))
      .map((asset) => ({ value: asset.id, label: asset.name?.trim() || asset.code }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [query.data, unitIds]);
}
