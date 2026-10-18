import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { useFlowRoutes } from '@/api/v2/queries/plant-model';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import type { FlowRouteView } from '@/api/v2/types/plant-model';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { Quantity } from '@/features/ux-kit/quantity';
import { ActionIcon } from '@/lib/icons';
import { VersionStateBadge } from '@/features/ux-kit/version-state-badge';
import type { PlanningRefs } from '@/features/plans-profiles-calendars/hooks/use-planning-refs';
import { VersionActions } from '@/features/plans-profiles-calendars/profiles/version-actions';
import { FlowRouteForm } from './flow-route-form';

export interface FlowRoutesSectionProps {
  refs: PlanningRefs;
  routes: ReturnType<typeof useFlowRoutes>;
  canWrite: boolean;
}

function columnsOf(refs: PlanningRefs): DataTableColumn<FlowRouteView>[] {
  const uom = (r: FlowRouteView) => r.inventoryUom ?? '';
  return [
    {
      id: 'route',
      header: 'Route',
      cell: (r) => (
        <span className="font-medium" data-testid="flow-route-row">
          {refs.unitName(r.fromUnitId)} → {refs.unitName(r.toUnitId)}
        </span>
      ),
    },
    { id: 'role', header: 'Role', nowrap: true, cell: (r) => (r.routeRole === 'alternate' ? 'Alternate' : 'Feed') },
    { id: 'buffer', header: 'Buffer', cell: (r) => r.bufferName ?? (r.usableInventory || r.maxOperatingLevel ? 'Buffer' : 'Direct (no buffer)') },
    { id: 'usable', header: 'Usable inventory', align: 'right', nowrap: true, cell: (r) => (r.usableInventory ? <Quantity value={r.usableInventory} uom={uom(r)} /> : '—') },
    { id: 'draw', header: 'Downstream draw / h', align: 'right', nowrap: true, cell: (r) => (r.drawRatePerHour ? <Quantity value={r.drawRatePerHour} uom={uom(r)} /> : '—') },
    {
      id: 'effective',
      header: 'Effective',
      nowrap: true,
      cell: (r) => (
        <span className="text-xs">
          <PlantTime iso={r.effectiveFrom} tz={refs.timezone} withDate /> → {r.effectiveTo ? <PlantTime iso={r.effectiveTo} tz={refs.timezone} withDate /> : 'open-ended'}
        </span>
      ),
    },
    { id: 'state', header: 'State', cell: (r) => <VersionStateBadge state={r.state} /> },
    { id: 'actions', header: 'Actions', cell: (r) => <VersionActions resource="flow-routes" id={r.id} state={r.state} timezone={refs.timezone} authorId={r.createdBy} /> },
  ];
}

/** Routes of the material-flow map with their buffers; drafts are approved by another user. */
export function FlowRoutesSection({ refs, routes, canWrite }: FlowRoutesSectionProps) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-2" data-testid="flow-routes-section">
      {canWrite && !adding && (
        <Button size="sm" onClick={() => setAdding(true)} data-testid="flow-route-new">
          <ActionIcon.add className="h-4 w-4" aria-hidden="true" />
          Add route
        </Button>
      )}
      {adding && <FlowRouteForm unitOptions={refs.unitOptions} timezone={refs.timezone} onDone={() => setAdding(false)} />}
      <DataTable
        caption="Material-flow routes"
        columns={columnsOf(refs)}
        rows={flattenPages(routes.data?.pages)}
        getRowKey={(r) => r.id}
        status={{ isLoading: routes.isLoading, isError: routes.isError, error: routes.error, onRetry: () => void routes.refetch() }}
        empty={{ title: 'No routes', text: 'Without routes no stop propagates between units: each unit counts its own losses only.' }}
      />
      {routes.hasNextPage && (
        <Button size="sm" variant="ghost" onClick={() => void routes.fetchNextPage()} disabled={routes.isFetchingNextPage}>
          Load more routes
        </Button>
      )}
    </div>
  );
}
