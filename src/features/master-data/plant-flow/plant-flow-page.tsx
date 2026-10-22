import { useMemo } from 'react';
import { useApprovedFlowRoutes, useFlowRoutes } from '@/api/v2/queries/plant-model';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { usePlanningRefs } from '@/features/plans-profiles-calendars/hooks/use-planning-refs';
import { useAnchorFocus } from '@/features/ux-kit/use-anchor-focus';
import { infiniteListState, useSeekAnchor } from '@/features/ux-kit/use-seek-anchor';
import { MasterDataLayout } from '../components/master-data-layout';
import { BufferLevelsSection } from './buffer-levels-section';
import { FlowRoutesSection } from './flow-routes-section';
import { routeKeyOf } from './plant-flow-form-model';

/**
 * `/master-data/plant-flow` (SME E2): the plant's material-flow map — which unit feeds which, through
 * which buffer — and recorded buffer levels. An upstream stop first consumes the buffer's cover; only the
 * rest starves the downstream unit, charged to the upstream stop (all computed by the server). Adding a
 * route or recording a level opens a dialog from the section's header action.
 */
export function PlantFlowPage() {
  const { canWriteProfiles, canWritePeriods } = useCapabilities();
  const refs = usePlanningRefs();
  const anchor = useAnchorFocus('flow-route-');
  const routes = useFlowRoutes(anchor.focus);
  useSeekAnchor(anchor, infiniteListState(routes.query));
  // the buffers a level can be recorded for: every approved route, not only those on the table's current page
  const approved = useApprovedFlowRoutes();
  const bufferOptions = useMemo(
    () =>
      approved.items
        .filter((r) => r.inventoryUom)
        .map((r) => ({ value: routeKeyOf(r), label: `${refs.unitName(r.fromUnitId)} → ${refs.unitName(r.toUnitId)}${r.bufferName ? ` (${r.bufferName})` : ''}` })),
    [approved.items, refs],
  );
  return (
    <MasterDataLayout
      title="Plant flow"
      alsoAllowed={canWriteProfiles}
      description="Which unit feeds which and the buffers between them: a stop upstream uses the buffer's cover before it costs the unit downstream."
    >
      <FlowRoutesSection refs={refs} routes={routes} anchor={anchor} canWrite={canWriteProfiles} />
      <BufferLevelsSection refs={refs} bufferOptions={bufferOptions} canWrite={canWritePeriods} />
    </MasterDataLayout>
  );
}
