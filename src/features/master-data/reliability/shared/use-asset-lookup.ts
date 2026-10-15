import { useCallback, useMemo } from 'react';
import type { MasterAssetView } from '../../api/master-data-types';
import { ASSETS } from '../../api/record-resource';
import { useRecordLookup } from '../../api/use-record-queries';

/** Native select styling of the reliability forms (matches the shadcn inputs). */
export const SELECT_CLASS = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm';

/** Active assets of the plant by code (every page followed) and `code — name` of an id for table cells. */
export function useAssetLookup() {
  const lookup = useRecordLookup<MasterAssetView>(ASSETS, { status: 'active', sort: 'code' });
  const byId = useMemo(() => new Map(lookup.items.map((a) => [a.id, a])), [lookup.items]);
  const labelOf = useCallback((id: string | null) => {
    if (!id) return '—';
    const asset = byId.get(id);
    return asset ? `${asset.code} — ${asset.name}` : 'Asset not in the active list';
  }, [byId]);
  return { assets: lookup.items, isLoading: lookup.isLoading, labelOf };
}
