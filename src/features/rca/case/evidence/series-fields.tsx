import { DateTimeInput } from '@/features/ux-kit/date-inputs';
import { RCA_SERIES_MODE_LABELS } from '@/features/ux-kit/labels/rca-labels';
import { SERIES_MODES, type SeriesForm } from '../../model/evidence-form';
import { useRcaFormat } from '../../use-rca-format';
import { ChoiceField, FieldGroup, TextField } from './form-controls';

/** The historian query of a "Time Series" item: PI streams, mode and window (stored with the evidence). */
export function SeriesFields({ value, onChange }: { value: SeriesForm; onChange: (next: SeriesForm) => void }) {
  const { timezone } = useRcaFormat();
  const set = (patch: Partial<SeriesForm>) => onChange({ ...value, ...patch });
  const modes = SERIES_MODES.map((mode) => ({ value: mode, label: RCA_SERIES_MODE_LABELS[mode] }));
  return (
    <FieldGroup title="Time series (PI historian)" info="Record which streams and window support this evidence.">
      <TextField id="ts-streams" label="Streams or tags" value={value.streams} maxLength={2000} placeholder="e.g. P101.VIB, P101.TEMP" onChange={(streams) => set({ streams })} wide />
      <ChoiceField id="ts-mode" label="Mode" value={value.mode} options={modes} onChange={(mode) => set({ mode })} />
      <TextField id="ts-interval" label="Interval" value={value.interval} maxLength={20} placeholder="e.g. 1m" onChange={(interval) => set({ interval })} />
      <DateTimeInput label="From" value={value.start} timeZone={timezone} onChange={(start) => set({ start })} />
      <DateTimeInput label="To" value={value.end} timeZone={timezone} onChange={(end) => set({ end })} />
      <TextField id="ts-intervals" label="Number of intervals" value={value.intervals} onChange={(intervals) => set({ intervals })} />
      <TextField id="ts-summary" label="Summary types" value={value.summaryTypes} maxLength={100} placeholder="e.g. min, max, average" onChange={(summaryTypes) => set({ summaryTypes })} />
    </FieldGroup>
  );
}
