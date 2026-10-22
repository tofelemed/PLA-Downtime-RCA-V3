import { useState } from 'react';
import { Link } from 'react-router-dom';
import { withReturnTo } from '@/features/ux-kit/page-layout';
import { Button } from '@/components/ui/button';
import { useV2InfiniteList, flattenPages } from '@/api/v2/queries/use-v2-list';
import { EntityIcon } from '@/lib/icons';
import type { MasterAssetView, MasterUnitView } from '../api/master-data-types';
import { HierarchyNode } from './hierarchy-node';

/** records opened from the hierarchy return to it (Back, Cancel) */
const HIERARCHY_PATH = '/master-data/hierarchy';

const PAGE = 50;

function UnitAssets({ unitId, level }: { unitId: string; level: number }) {
  const assets = useV2InfiniteList<MasterAssetView>({
    resource: 'assets',
    path: '/assets',
    query: { unitIds: unitId, status: 'active', sort: 'code', limit: PAGE },
    key: { filters: { kind: '/assets', tree: unitId } },
  });
  const rows = flattenPages(assets.data?.pages);
  if (assets.isLoading) return <li className="py-1 text-sm text-muted-foreground" style={{ paddingLeft: level * 20 + 28 }}>Loading assets…</li>;
  if (assets.isError) {
    return (
      <li className="text-sm text-destructive" style={{ paddingLeft: level * 20 + 28 }}>
        Could not load the assets.{' '}
        <Button size="sm" variant="link" onClick={() => void assets.refetch()}>Try again</Button>
      </li>
    );
  }
  if (rows.length === 0) return <li className="py-1 text-sm text-muted-foreground" style={{ paddingLeft: level * 20 + 28 }}>No active assets</li>;
  return (
    <>
      {rows.map((asset) => (
        <HierarchyNode
          key={asset.id}
          level={level}
          icon={EntityIcon.asset}
          kind="Asset"
          label={`${asset.code} — ${asset.name}`}
          expandable={false}
          expanded={false}
          onToggle={() => undefined}
          actions={
            <Button size="sm" variant="ghost" asChild>
              <Link to={withReturnTo(`/master-data/assets/${asset.id}`, HIERARCHY_PATH)} aria-label={`Open asset ${asset.name}`}>Open</Link>
            </Button>
          }
        />
      ))}
      {assets.hasNextPage && (
        <li style={{ paddingLeft: level * 20 + 28 }}>
          <Button size="sm" variant="link" disabled={assets.isFetchingNextPage} onClick={() => void assets.fetchNextPage()}>
            Show more assets
          </Button>
        </li>
      )}
    </>
  );
}

/** A unit of the acting plant; its assets load when it is expanded (pages of 50, "Show more"). */
export function UnitNode({ unit, level, canWrite }: { unit: MasterUnitView; level: number; canWrite: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const actions = (
    <>
      {canWrite && (
        <Button size="sm" variant="ghost" asChild>
          <Link to={withReturnTo(`/master-data/assets/new?unitId=${unit.id}`, HIERARCHY_PATH)} aria-label={`Add asset to ${unit.name}`}>Add asset</Link>
        </Button>
      )}
      <Button size="sm" variant="ghost" asChild>
        <Link to={withReturnTo(`/master-data/units/${unit.id}`, HIERARCHY_PATH)} aria-label={`Open unit ${unit.name}`}>Open</Link>
      </Button>
    </>
  );
  return (
    <HierarchyNode
      level={level}
      icon={EntityIcon.unit}
      kind="Unit"
      label={`${unit.code} — ${unit.name}`}
      expandable
      expanded={expanded}
      onToggle={() => setExpanded((open) => !open)}
      actions={actions}
    >
      {expanded && <UnitAssets unitId={unit.id} level={level + 1} />}
    </HierarchyNode>
  );
}
