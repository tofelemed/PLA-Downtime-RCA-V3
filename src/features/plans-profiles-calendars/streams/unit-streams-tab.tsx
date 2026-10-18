import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useUnitStreams } from '@/api/v2/queries/plant-model';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import type { UnitStreamView } from '@/api/v2/types/plant-model';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { LocalizedNumber } from '@/features/ux-kit/localized-number';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { ReadOnlyHint } from '@/features/ux-kit/read-only-hint';
import { ActionIcon } from '@/lib/icons';
import { FormField } from '../components/form-field';
import { NativeSelect } from '../components/native-select';
import { VersionStateBadge } from '@/features/ux-kit/version-state-badge';
import { usePlanningRefs, type PlanningRefs } from '../hooks/use-planning-refs';
import { percentOfShare } from '../model/stream-form';
import { VersionActions } from '../profiles/version-actions';
import { StreamRunsPanel } from './stream-runs-panel';
import { UnitStreamForm } from './unit-stream-form';

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
          <PlantTime iso={s.effectiveFrom} tz={refs.timezone} withDate /> → {s.effectiveTo ? <PlantTime iso={s.effectiveTo} tz={refs.timezone} withDate /> : 'open-ended'}
        </span>
      ),
    },
    { id: 'state', header: 'State', cell: (s) => <VersionStateBadge state={s.state} /> },
    { id: 'actions', header: 'Actions', cell: (s) => <VersionActions resource="unit-streams" id={s.id} state={s.state} timezone={refs.timezone} authorId={s.createdBy} /> },
  ];
}

/**
 * Streams of a unit (SME E6 / LA-10): parallel trains or lines with their share of the unit's rate, and
 * the products they run. With runs recorded, each product gets the capacity of the stream time it ran
 * (concurrent products are never counted twice); without, the unit is one stream as before.
 */
export function UnitStreamsTab() {
  const { canWriteProfiles, canWritePeriods } = useCapabilities();
  const refs = usePlanningRefs();
  const [unitId, setUnitId] = useState('');
  const [adding, setAdding] = useState(false);
  const streams = useUnitStreams(unitId);
  const rows = flattenPages(streams.data?.pages);
  const streamOptions = useMemo(
    () => [...new Set(rows.filter((s) => s.state === 'approved').map((s) => s.code))].map((code) => ({ value: code, label: code })),
    [rows],
  );
  return (
    <div className="space-y-4" data-testid="unit-streams-tab">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-64">
          <FormField id="streamUnit" label="Unit">
            <NativeSelect id="streamUnit" value={unitId} options={refs.unitOptions} placeholder="Choose a unit" onChange={setUnitId} />
          </FormField>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ReadOnlyHint />
          {canWriteProfiles && unitId && !adding && (
            <Button size="sm" onClick={() => setAdding(true)} data-testid="unit-stream-new">
              <ActionIcon.add className="h-4 w-4" aria-hidden="true" />
              Add stream
            </Button>
          )}
        </div>
      </div>
      {adding && unitId && <UnitStreamForm unitId={unitId} timezone={refs.timezone} onDone={() => setAdding(false)} />}
      {unitId ? (
        <>
          <DataTable
            caption="Unit streams"
            columns={columnsOf(refs)}
            rows={rows}
            getRowKey={(s) => s.id}
            getRowAnchor={(s) => `unit-stream-${s.id}`}
            status={{ isLoading: streams.isLoading, isError: streams.isError, error: streams.error, onRetry: () => void streams.refetch() }}
            empty={{ title: 'No streams', text: 'The unit is one stream: every product slice uses the whole period.' }}
          />
          <StreamRunsPanel unitId={unitId} refs={refs} streamOptions={streamOptions} canWrite={canWritePeriods} />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Choose a unit to see its streams and the products they run.</p>
      )}
    </div>
  );
}
