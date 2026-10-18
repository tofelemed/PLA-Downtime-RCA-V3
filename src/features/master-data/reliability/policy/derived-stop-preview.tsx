import { useState } from 'react';
import { useDerivedStopPreview } from '@/api/v2/queries/reliability-policies';
import { rollingWindow, DAY_MS } from '@/api/v2/queries/time-window';
import { Button } from '@/components/ui/button';
import { DateRangeInput, type InstantRange } from '@/features/ux-kit/date-inputs';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { PlantTime } from '@/features/ux-kit/plant-time';

export function DerivedStopPreview({ unitId, timezone }: { unitId: string; timezone: string }) {
  const [range, setRange] = useState<InstantRange>(() => rollingWindow(DAY_MS));
  const preview = useDerivedStopPreview();
  return <div className="space-y-3">
    <p className="text-sm text-muted-foreground">Preview stored state samples over at most 7 days. This reads the settings effective at the window end and writes no events. Unknown state time is never counted as a stop.</p>
    <DateRangeInput label="State preview period" value={range} timeZone={timezone} onChange={setRange} />
    <Button variant="outline" disabled={!unitId || !range.from || !range.to || preview.isPending} onClick={() => { if (range.from && range.to) void preview.submit({ unitId, from: range.from, to: range.to }).catch(() => null); }}>Preview derived stops and slowdowns</Button>
    {!unitId && <p className="text-sm">Choose a unit to preview its state engine.</p>}
    {preview.error && <FriendlyErrorAlert error={preview.error} />}
    {preview.data && <div className="space-y-2 text-sm" aria-live="polite">
      <p>{preview.data.mapped ? `${preview.data.stops.length} stop(s), ${preview.data.slowdowns.length} slowdown(s)` : 'No state mapping at the start of this window.'}</p>
      {[...preview.data.stops, ...preview.data.slowdowns].map((row) => <div className="rounded border p-2" key={row.key}><p>{row.description}</p><PlantTime iso={row.startTime} tz={timezone} withDate /> to {row.endTime ? <PlantTime iso={row.endTime} tz={timezone} withDate /> : 'open at window end'}</div>)}
    </div>}
  </div>;
}
