import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useBufferLevels } from '@/api/v2/queries/plant-model';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import type { BufferLevelView } from '@/api/v2/types/plant-model';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { DisabledReason } from '@/features/ux-kit/disabled-reason';
import { Section } from '@/features/ux-kit/page-layout';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { Quantity } from '@/features/ux-kit/quantity';
import type { Option } from '@/features/plans-profiles-calendars/components/native-select';
import type { PlanningRefs } from '@/features/plans-profiles-calendars/hooks/use-planning-refs';
import { ActionIcon } from '@/lib/icons';
import { BufferLevelDialog } from './buffer-level-dialog';

function levelColumns(refs: PlanningRefs): DataTableColumn<BufferLevelView>[] {
  return [
    { id: 'buffer', header: 'Buffer', cell: (l) => `${refs.unitName(l.fromUnitId)} → ${refs.unitName(l.toUnitId)}` },
    { id: 'at', header: 'Read at', nowrap: true, cell: (l) => <PlantTime iso={l.observedAt} tz={refs.timezone} withDate /> },
    { id: 'level', header: 'Level', align: 'right', nowrap: true, cell: (l) => <Quantity value={l.level} uom={l.uom} /> },
    { id: 'source', header: 'Source', cell: (l) => l.source },
  ];
}

export interface BufferLevelsSectionProps {
  refs: PlanningRefs;
  /** approved routes with a buffer, as "From → To (buffer)" */
  bufferOptions: Option[];
  canWrite: boolean;
}

/** Recorded buffer levels; "Record buffer level" in the section header opens a dialog. */
export function BufferLevelsSection({ refs, bufferOptions, canWrite }: BufferLevelsSectionProps) {
  const levels = useBufferLevels();
  const [recording, setRecording] = useState(false);
  const noBuffer = bufferOptions.length === 0 ? 'Approve a route with a buffer first.' : null;
  const action = canWrite ? (
    <>
      <DisabledReason id="buffer-level-new-reason" reason={noBuffer} />
      <Button type="button" size="sm" onClick={() => setRecording(true)} disabled={noBuffer !== null} aria-describedby={noBuffer ? 'buffer-level-new-reason' : undefined} data-testid="buffer-level-new">
        <ActionIcon.add className="h-4 w-4" aria-hidden="true" />
        Record buffer level
      </Button>
    </>
  ) : null;
  return (
    <Section title="Buffer levels" description="A level read within 24 h before an upstream stop replaces the configured usable inventory." actions={action}>
      <div className="space-y-2">
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
      </div>
      {recording && <BufferLevelDialog bufferOptions={bufferOptions} timezone={refs.timezone} onClose={() => setRecording(false)} />}
    </Section>
  );
}
