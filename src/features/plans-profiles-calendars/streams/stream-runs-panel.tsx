import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useStreamRuns } from '@/api/v2/queries/plant-model';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import type { StreamRunView } from '@/api/v2/types/plant-model';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { ActionIcon } from '@/lib/icons';
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
  return (
    <section className="space-y-2" data-testid="stream-runs-panel">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Stream runs</h3>
        {canWrite && !adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)} disabled={streamOptions.length === 0}>
            <ActionIcon.add className="h-4 w-4" aria-hidden="true" />
            Record run
          </Button>
        )}
      </div>
      {adding && <StreamRunForm unitId={unitId} streamOptions={streamOptions} productOptions={refs.productOptions} timezone={refs.timezone} onDone={() => setAdding(false)} />}
      <DataTable
        caption="Stream runs"
        columns={columnsOf(refs, canWrite)}
        rows={flattenPages(runs.data?.pages)}
        getRowKey={(r) => r.id}
        status={{ isLoading: runs.isLoading, isError: runs.isError, error: runs.error, onRetry: () => void runs.refetch() }}
        empty={{ title: 'No stream runs', text: 'Without runs the unit is accounted as one stream over each whole period.' }}
      />
      {runs.hasNextPage && (
        <Button size="sm" variant="ghost" onClick={() => void runs.fetchNextPage()} disabled={runs.isFetchingNextPage}>
          Load more runs
        </Button>
      )}
    </section>
  );
}
