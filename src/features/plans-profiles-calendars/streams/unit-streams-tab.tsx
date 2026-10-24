import { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { useApprovedUnitStreams, useUnitStreams } from '@/api/v2/queries/plant-model';
import type { UnitStreamView } from '@/api/v2/types/plant-model';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { FIELD_CLASS } from '@/features/pla-analytics/components/filter-classes';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { LocalizedNumber } from '@/features/ux-kit/localized-number';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { ChooseUnitEmpty } from '../components/choose-unit-empty';
import { NativeSelect } from '../components/native-select';
import { TableCard } from '../components/table-card';
import { VersionStateBadge } from '@/features/ux-kit/version-state-badge';
import { usePlanningRefs, type PlanningRefs } from '../hooks/use-planning-refs';
import { percentOfShare } from '../model/stream-form';
import { VersionActions } from '../profiles/version-actions';
import { StreamRunsPanel } from './stream-runs-panel';
import { FocusedListNotice } from '@/features/ux-kit/focused-list-notice';
import { useAnchorFocus } from '@/features/ux-kit/use-anchor-focus';
import { infiniteListState, useSeekAnchor } from '@/features/ux-kit/use-seek-anchor';
import { useUnitParam } from '../hooks/use-unit-param';

function columnsOf(refs: PlanningRefs): DataTableColumn<UnitStreamView>[] {
  return [
    { id: 'code', header: 'Stream', cell: (s) => <span className="font-medium" data-testid="unit-stream-row">{s.code} · {s.name}</span> },
    { id: 'version', header: 'Version', nowrap: true, cell: (s) => `Version ${s.version}` },
    { id: 'share', header: "Share of the unit's rate", align: 'right', nowrap: true, cell: (s) => <LocalizedNumber text={`${percentOfShare(s.capacityShare)} %`} /> },
    {
      id: 'effective',
      header: 'Effective',
      nowrap: true,
      cell: (s) => (
        <span className="text-xs">
          <PlantTime iso={s.effectiveFrom} tz={refs.timezone} withDate withZone={false} /> → {s.effectiveTo ? <PlantTime iso={s.effectiveTo} tz={refs.timezone} withDate withZone={false} /> : 'open-ended'}
        </span>
      ),
    },
    { id: 'state', header: 'State', nowrap: true, cell: (s) => <VersionStateBadge state={s.state} /> },
    { id: 'actions', header: 'Actions', nowrap: true, cell: (s) => <VersionActions resource="unit-streams" id={s.id} state={s.state} timezone={refs.timezone} authorId={s.createdBy} /> },
  ];
}

const STREAMS_INFO = "Parallel trains or lines with their share of the unit's rate. With runs recorded, each product gets the capacity of the stream time it ran.";

/**
 * Streams of a unit (SME E6 / LA-10): parallel trains or lines with their share of the unit's rate, and
 * the products they run. With runs recorded, each product gets the capacity of the stream time it ran
 * (concurrent products are never counted twice); without, the unit is one stream as before.
 */
export function UnitStreamsTab() {
  const { canWritePeriods } = useCapabilities();
  const refs = usePlanningRefs();
  // a deep link names the unit of the linked row (`?unitId=…#…`); the choice stays in the URL
  const [unitId, setUnitId] = useUnitParam();
  const anchor = useAnchorFocus('unit-stream-');
  const streams = useUnitStreams(unitId, anchor.focus);
  useSeekAnchor(anchor, infiniteListState(streams.query));
  // the run form offers every approved stream, not only those on the table's current page
  const approved = useApprovedUnitStreams(unitId);
  const streamOptions = useMemo(
    () => [...new Set(approved.items.map((s) => s.code))].map((code) => ({ value: code, label: code })),
    [approved.items],
  );
  return (
    <div className="space-y-4" data-testid="unit-streams-tab">
      <div className="flex flex-wrap items-end gap-3">
        <div className={`${FIELD_CLASS} w-64`}>
          <Label htmlFor="streamUnit">Unit</Label>
          <NativeSelect id="streamUnit" value={unitId} options={refs.unitOptions} placeholder="Choose a unit" onChange={setUnitId} />
        </div>
      </div>
      {unitId ? (
        <>
          <FocusedListNotice anchor={anchor} what="streams" />
          <TableCard title="Streams" info={STREAMS_INFO}>
            <DataTable
              caption="Unit streams"
              columns={columnsOf(refs)}
              rows={streams.rows}
              getRowKey={(s) => s.id}
              getRowAnchor={(s) => `unit-stream-${s.id}`}
              pager={streams.pager}
              status={streams.status}
              empty={{ title: 'No streams', text: 'No streams: the unit is one stream and every product slice uses the whole period.' }}
            />
          </TableCard>
          <StreamRunsPanel unitId={unitId} refs={refs} streamOptions={streamOptions} canWrite={canWritePeriods} />
        </>
      ) : (
        <ChooseUnitEmpty what="streams and the products they run" />
      )}
    </div>
  );
}
