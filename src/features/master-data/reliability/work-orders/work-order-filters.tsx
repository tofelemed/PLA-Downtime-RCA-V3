import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AssetSelect } from '../shared/asset-select';

export interface WorkOrderFiltersBarProps {
  assetId: string;
  eventId: string;
  onChange: (key: 'assetId' | 'eventId', value: string) => void;
}

/** One bottom-aligned row: the asset select (label above) and, from a stop's page, the "one stop" scope with its way back. */
export function WorkOrderFiltersBar({ assetId, eventId, onChange }: WorkOrderFiltersBarProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-72">
        <AssetSelect id="wo-asset" label="Asset" value={assetId} onChange={(v) => onChange('assetId', v)} allowAll />
      </div>
      {eventId && (
        <p className="flex h-9 items-center gap-2 text-sm" role="status">
          Operations of <Link className="underline" to={`/events/${eventId}?tab=repair`}>one stop</Link>
          <Button size="sm" variant="ghost" onClick={() => onChange('eventId', '')}>Show every stop</Button>
        </p>
      )}
    </div>
  );
}
