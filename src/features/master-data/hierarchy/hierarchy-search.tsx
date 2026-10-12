import { Link } from 'react-router-dom';
import { useV2InfiniteList, flattenPages } from '@/api/v2/queries/use-v2-list';
import { useUnitNames } from '@/features/ux-kit/labels';
import { EntityIcon } from '@/lib/icons';
import type { MasterAssetView, MasterUnitView } from '../api/master-data-types';

const LIMIT = 20;

/**
 * Search results of the hierarchy: active units and assets of the selected plant whose code or name
 * contains the text (first 20 of each, with a hint when there are more).
 */
export function HierarchySearchResults({ q }: { q: string }) {
  const unitNames = useUnitNames();
  const units = useV2InfiniteList<MasterUnitView>({
    resource: 'units',
    path: '/units',
    query: { q, status: 'active', sort: 'code', limit: LIMIT },
    key: { filters: { kind: '/units', search: q } },
  });
  const assets = useV2InfiniteList<MasterAssetView>({
    resource: 'assets',
    path: '/assets',
    query: { q, status: 'active', sort: 'code', limit: LIMIT },
    key: { filters: { kind: '/assets', search: q } },
  });
  const unitRows = flattenPages(units.data?.pages);
  const assetRows = flattenPages(assets.data?.pages);
  if (units.isLoading || assets.isLoading) return <p className="text-sm text-muted-foreground">Searching…</p>;
  if (units.isError || assets.isError) return <p className="text-sm text-destructive">The search could not be completed. Try again.</p>;
  if (unitRows.length + assetRows.length === 0) return <p className="text-sm text-muted-foreground">No unit or asset matches “{q}”.</p>;
  return (
    <ul className="space-y-1" aria-label="Search results">
      {unitRows.map((unit) => (
        <li key={unit.id} className="flex items-center gap-2 text-sm">
          <EntityIcon.unit className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span className="sr-only">Unit: </span>
          <Link className="underline-offset-4 hover:underline" to={`/master-data/units/${unit.id}`}>
            {unit.code} — {unit.name}
          </Link>
        </li>
      ))}
      {assetRows.map((asset) => (
        <li key={asset.id} className="flex items-center gap-2 text-sm">
          <EntityIcon.asset className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span className="sr-only">Asset: </span>
          <Link className="underline-offset-4 hover:underline" to={`/master-data/assets/${asset.id}`}>
            {asset.code} — {asset.name}
          </Link>
          <span className="text-muted-foreground">in {unitNames.nameOf(asset.unitId)}</span>
        </li>
      ))}
      {(units.hasNextPage || assets.hasNextPage) && (
        <li className="text-xs text-muted-foreground">More matches exist; refine the search, or use the Units and Assets lists.</li>
      )}
    </ul>
  );
}
