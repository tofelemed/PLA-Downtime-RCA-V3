import { useMemo } from 'react';
import { useAssetDirectory } from '@/api/v2/queries/assets';
import type { CheckOption } from '../components/multi-check-select';

/**
 * Asset filter choices from the v2 asset directory (FE-09), limited to the chosen units, sorted by name;
 * retired assets stay choosable (their past events are still listed) and are marked.
 */
export function useAssetOptions(unitIds: readonly string[]): CheckOption[] {
  const { assets } = useAssetDirectory();
  return useMemo(() => {
    const units = new Set(unitIds);
    return assets
      .filter((asset) => units.size === 0 || units.has(asset.unitId))
      .map((asset) => ({ value: asset.id, label: `${asset.name?.trim() || asset.code}${asset.retiredAt ? ' (retired)' : ''}` }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [assets, unitIds]);
}
