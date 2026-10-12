import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useV2InfiniteList, flattenPages } from '@/api/v2/queries/use-v2-list';
import { EntityIcon } from '@/lib/icons';
import type { Organization, Tenant } from '@/services/api/masterDataApi';
import type { MasterUnitView } from '../api/master-data-types';
import { HierarchyNode } from './hierarchy-node';
import { UnitNode } from './unit-node';

const PAGE = 50;

function PlantUnits({ level, canWrite }: { level: number; canWrite: boolean }) {
  const units = useV2InfiniteList<MasterUnitView>({
    resource: 'units',
    path: '/units',
    query: { status: 'active', sort: 'code', limit: PAGE },
    key: { filters: { kind: '/units', tree: true } },
  });
  const rows = flattenPages(units.data?.pages);
  const indent = { paddingLeft: level * 20 + 28 };
  if (units.isLoading) return <li className="py-1 text-sm text-muted-foreground" style={indent}>Loading units…</li>;
  if (units.isError) {
    return (
      <li className="text-sm text-destructive" style={indent}>
        Could not load the units.{' '}
        <Button size="sm" variant="link" onClick={() => void units.refetch()}>Try again</Button>
      </li>
    );
  }
  if (rows.length === 0) return <li className="py-1 text-sm text-muted-foreground" style={indent}>No active units</li>;
  return (
    <>
      {rows.map((unit) => (
        <UnitNode key={unit.id} unit={unit} level={level} canWrite={canWrite} />
      ))}
      {units.hasNextPage && (
        <li style={indent}>
          <Button size="sm" variant="link" disabled={units.isFetchingNextPage} onClick={() => void units.fetchNextPage()}>
            Show more units
          </Button>
        </li>
      )}
    </>
  );
}

export interface PlantNodeProps {
  organization: Organization;
  plant: Tenant;
  acting: boolean;
  level: number;
  canWrite: boolean;
  onSwitch: (organization: Organization, plant: Tenant) => void;
}

/**
 * A plant of the organisation. The selected (acting) plant lists its units lazily; every request acts on
 * the selected plant, so another plant offers "Switch to this plant" to see its units.
 */
export function PlantNode({ organization, plant, acting, level, canWrite, onSwitch }: PlantNodeProps) {
  const [expanded, setExpanded] = useState(acting);
  const actions = acting ? (
    canWrite ? (
      <Button size="sm" variant="ghost" asChild>
        <Link to="/master-data/units/new" aria-label={`Add unit to ${plant.name}`}>Add unit</Link>
      </Button>
    ) : undefined
  ) : (
    <Button size="sm" variant="ghost" onClick={() => onSwitch(organization, plant)}>
      Switch to this plant
    </Button>
  );
  return (
    <HierarchyNode
      level={level}
      icon={EntityIcon.plant}
      kind="Plant"
      label={plant.name}
      badge={acting ? 'Selected plant' : undefined}
      expandable={acting}
      expanded={acting && expanded}
      onToggle={() => setExpanded((open) => !open)}
      actions={actions}
    >
      {acting && expanded && <PlantUnits level={level + 1} canWrite={canWrite} />}
    </HierarchyNode>
  );
}
