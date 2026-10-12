import { useMemo, useState } from 'react';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { labelOf, SAMPLE_QUALITY_LABELS } from '@/features/ux-kit/labels';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { Field } from '../components/field';
import { NativeSelect } from '../components/native-select';
import { sampleValue, type SignalSample } from './historian-model';

export interface SamplesTableProps {
  series: ReadonlyArray<{ id: string; name: string; samples: readonly SignalSample[] }>;
  timezone: string;
}

/** Stored samples of one of the trended signals in the period, 20 per page (newest revision of each). */
export function SamplesTable({ series, timezone }: SamplesTableProps) {
  const [chosen, setChosen] = useState('');
  const shown = series.find((entry) => entry.id === chosen) ?? series[0];
  const rows = useMemo(() => (shown ? shown.samples.filter((sample) => sample.inWindow) : []), [shown]);
  const columns = useMemo<DataTableColumn<SignalSample>[]>(
    () => [
      { id: 'time', header: 'Time', nowrap: true, cell: (sample) => <PlantTime iso={sample.observedAt} tz={timezone} withDate /> },
      { id: 'value', header: 'Value', align: 'right', nowrap: true, cell: sampleValue },
      { id: 'quality', header: 'Quality', nowrap: true, cell: (sample) => labelOf(SAMPLE_QUALITY_LABELS, sample.quality) },
      { id: 'revisions', header: 'Revisions', align: 'right', nowrap: true, cell: (sample) => sample.revisions },
    ],
    [timezone],
  );
  if (!shown) return null;
  return (
    <div className="space-y-3" data-testid="trend-samples">
      {series.length > 1 && (
        <div className="max-w-xs">
          <Field id="samples-of" label="Samples of">
            <NativeSelect id="samples-of" value={shown.id} options={series.map((entry) => ({ value: entry.id, label: entry.name }))} onChange={setChosen} />
          </Field>
        </div>
      )}
      <DataTable
        caption={`Samples of ${shown.name}`}
        columns={columns}
        rows={rows}
        getRowKey={(sample) => `${sample.observedAt}|${sample.sourceRevision}`}
        empty={{ title: 'No samples', text: 'Nothing was stored for this signal in the period.' }}
      />
    </div>
  );
}
