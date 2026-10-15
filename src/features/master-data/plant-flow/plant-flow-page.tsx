import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useBufferLevels, useFlowRoutes } from '@/api/v2/queries/plant-model';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import type { BufferLevelView } from '@/api/v2/types/plant-model';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { Section } from '@/features/ux-kit/page-layout';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { Quantity } from '@/features/ux-kit/quantity';
import { usePlanningRefs, type PlanningRefs } from '@/features/plans-profiles-calendars/hooks/use-planning-refs';
import { MasterDataLayout } from '../components/master-data-layout';
import { BufferLevelForm } from './buffer-level-form';
import { FlowRoutesSection } from './flow-routes-section';
import { routeKeyOf } from './plant-flow-form-model';

function levelColumns(refs: PlanningRefs): DataTableColumn<BufferLevelView>[] {
  return [
    { id: 'buffer', header: 'Buffer', cell: (l) => `${refs.unitName(l.fromUnitId)} → ${refs.unitName(l.toUnitId)}` },
    { id: 'at', header: 'Read at', nowrap: true, cell: (l) => <PlantTime iso={l.observedAt} tz={refs.timezone} withDate /> },
    { id: 'level', header: 'Level', align: 'right', nowrap: true, cell: (l) => <Quantity value={l.level} uom={l.uom} /> },
    { id: 'source', header: 'Source', cell: (l) => l.source },
  ];
}

/**
 * `/master-data/plant-flow` (SME E2): the plant's material-flow map — which unit feeds which, through
 * which buffer — and recorded buffer levels. An upstream stop first consumes the buffer's cover; only the
 * rest starves the downstream unit, charged to the upstream stop (all computed by the server).
 */
export function PlantFlowPage() {
  const { canWriteProfiles, canWritePeriods } = useCapabilities();
  const refs = usePlanningRefs();
  const routes = useFlowRoutes();
  const levels = useBufferLevels();
  const bufferOptions = useMemo(
    () =>
      flattenPages(routes.data?.pages)
        .filter((r) => r.state === 'approved' && r.inventoryUom)
        .map((r) => ({ value: routeKeyOf(r), label: `${refs.unitName(r.fromUnitId)} → ${refs.unitName(r.toUnitId)}${r.bufferName ? ` (${r.bufferName})` : ''}` })),
    [routes.data, refs],
  );
  return (
    <MasterDataLayout
      title="Plant flow"
      alsoAllowed={canWriteProfiles}
      description="Which unit feeds which and the buffers between them: a stop upstream uses the buffer's cover before it costs the unit downstream."
    >
      <Section title="Routes">
        <FlowRoutesSection refs={refs} routes={routes} canWrite={canWriteProfiles} />
      </Section>
      <Section title="Buffer levels" description="A level read within 24 h before an upstream stop replaces the configured usable inventory.">
        {canWritePeriods && <BufferLevelForm bufferOptions={bufferOptions} timezone={refs.timezone} />}
        <DataTable
          caption="Buffer levels"
          columns={levelColumns(refs)}
          rows={flattenPages(levels.data?.pages)}
          getRowKey={(l) => l.id}
          status={{ isLoading: levels.isLoading, isError: levels.isError, error: levels.error, onRetry: () => void levels.refetch() }}
          empty={{ title: 'No levels recorded', text: 'The configured usable inventory of each buffer applies.' }}
        />
        {levels.hasNextPage && (
          <Button size="sm" variant="ghost" onClick={() => void levels.fetchNextPage()} disabled={levels.isFetchingNextPage}>
            Load more levels
          </Button>
        )}
      </Section>
    </MasterDataLayout>
  );
}
