import { useState } from 'react';
import { useDerivedStopPreview } from '@/api/v2/queries/reliability-policies';
import { rollingWindow, DAY_MS } from '@/api/v2/queries/time-window';
import { Button } from '@/components/ui/button';
import { DateRangeInput, type InstantRange } from '@/features/ux-kit/date-inputs';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { plural } from '@/features/ux-kit/format/plural';

/** Derived stops and slowdowns of the unit over a window of stored state samples (the side panel's body). */
export function DerivedStopPreview({ unitId, timezone }: { unitId: string; timezone: string }) {
  const [range, setRange] = useState<InstantRange>(() => rollingWindow(DAY_MS));
  const preview = useDerivedStopPreview();
  const run = () => {
    if (range.from && range.to) void preview.submit({ unitId, from: range.from, to: range.to }).catch(() => null);
  };
  return <div className="space-y-3">
    <div className="flex flex-wrap items-end gap-3" data-testid="preview-window">
      <DateRangeInput label="State preview period" toLabel="To" value={range} timeZone={timezone} onChange={setRange} textEntry calendarPicker toolbar />
      <Button variant="outline" className="h-9" disabled={!unitId || !range.from || !range.to || preview.isPending} onClick={run}>Preview derived stops and slowdowns</Button>
    </div>
    {preview.error && <FriendlyErrorAlert error={preview.error} />}
    {preview.data && <div className="space-y-2 text-sm" aria-live="polite">
      <p>{preview.data.mapped ? `${plural(preview.data.stops.length, 'stop', 'stops')}, ${plural(preview.data.slowdowns.length, 'slowdown', 'slowdowns')}` : 'No state mapping at the start of this window.'}</p>
      {[...preview.data.stops, ...preview.data.slowdowns].map((row) => <div className="rounded border p-2" key={row.key}><p>{row.description}</p><PlantTime iso={row.startTime} tz={timezone} withDate withZone={false} /> to {row.endTime ? <PlantTime iso={row.endTime} tz={timezone} withDate withZone={false} /> : 'open at window end'}</div>)}
    </div>}
  </div>;
}
