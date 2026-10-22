import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useStreamRuns } from '@/api/v2/queries/plant-model';
import type { StreamRunView } from '@/api/v2/types/plant-model';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { DisabledReason } from '@/features/ux-kit/disabled-reason';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { ActionIcon } from '@/lib/icons';
import { AddDialog } from '@/features/ux-kit/add-dialog';
import type { Option } from '../components/native-select';
import type { PlanningRefs } from '../hooks/use-planning-refs';
import { EndRunAction } from './end-run-action';
import { StreamRunForm } from './stream-run-form';

export interface StreamRunsPanelProps {
  unitId: string;
  refs: PlanningRefs;
  streamOptions: Option[];
  canWrite: boolean;
}

function columnsOf(refs: PlanningRefs, canWrite: boolean): DataTableColumn<StreamRunView>[] {
  return [
    { id: 'stream', header: 'Stream', nowrap: true, cell: (r) => <span className="font-medium" data-testid="stream-run-row">{r.streamCode}</span> },
    { id: 'product', header: 'Product', cell: (r) => refs.productName(r.productId) },
    { id: 'lot', header: 'Lot', nowrap: true, cell: (r) => r.lotCode ?? '—' },
    { id: 'start', header: 'Start', nowrap: true, cell: (r) => <PlantTime iso={r.startTime} tz={refs.timezone} withDate /> },
    {
      id: 'end',
      header: 'End',
      nowrap: true,
      cell: (r) => (r.endTime ? <PlantTime iso={r.endTime} tz={refs.timezone} withDate /> : canWrite ? <EndRunAction runId={r.id} timezone={refs.timezone} /> : 'running'),
    },
  ];
}

/**
 * Which product each stream ran and the lot it made (SME E6). Output measured with a lot code keeps the
 * grade of its run; a stream's capacity goes to the product it ran — both computed by the server.
 */
export function StreamRunsPanel({ unitId, refs, streamOptions, canWrite }: StreamRunsPanelProps) {
  const [adding, setAdding] = useState(false);
  const runs = useStreamRuns(unitId);
  const reasonId = useId();
  const noStream = streamOptions.length === 0;
  return (
    <section className="space-y-2" data-testid="stream-runs-panel">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Stream runs</h3>
        {canWrite && (
          <div className="flex flex-col items-end gap-1">
            <Button size="sm" variant="outline" onClick={() => setAdding(true)} disabled={noStream} aria-describedby={noStream ? reasonId : undefined}>
              <ActionIcon.add className="h-4 w-4" aria-hidden="true" />
              Record run
            </Button>
            <DisabledReason id={reasonId} reason={noStream ? 'Add a stream first: a run says which stream ran the product.' : null} />
          </div>
        )}
      </div>
      <AddDialog open={adding} onOpenChange={setAdding} title="Record stream run" description="Which product a stream ran, and the lot it made." testId="stream-run-dialog">
        <StreamRunForm unitId={unitId} streamOptions={streamOptions} productOptions={refs.productOptions} timezone={refs.timezone} onDone={() => setAdding(false)} />
      </AddDialog>
      <DataTable
        caption="Stream runs"
        columns={columnsOf(refs, canWrite)}
        rows={runs.rows}
        getRowKey={(r) => r.id}
        pager={runs.pager}
        status={runs.status}
        empty={{ title: 'No stream runs', text: 'Without runs the unit is accounted as one stream over each whole period.' }}
      />
    </section>
  );
}
