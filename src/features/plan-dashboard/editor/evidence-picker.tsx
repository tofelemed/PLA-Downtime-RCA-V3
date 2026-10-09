import { Checkbox } from '@/components/ui/checkbox';
import { useProductionEvents } from '@/api/v2/queries/production-events';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import type { ReconciliationView } from '@/api/v2/types/reconciliation';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { PlantTime } from '@/features/ux-kit/plant-time';

export interface EvidencePickerProps {
  view: ReconciliationView;
  timezone: string;
  selected: string[];
  onChange: (eventIds: string[]) => void;
}

/** Events of the period's unit overlapping the period (server filter); the server checks the slice overlap on save. */
export function EvidencePicker({ view, timezone, selected, onChange }: EvidencePickerProps) {
  const events = useProductionEvents({ unitIds: [view.unitId], from: view.utcStart, to: view.utcEnd, limit: 50 }, timezone);
  const items = flattenPages(events.data?.pages);
  const toggle = (id: string, on: boolean) => onChange(on ? [...selected, id] : selected.filter((e) => e !== id));
  const state = dataStateOf(events, { isEmpty: items.length === 0 });
  return (
    <fieldset className="space-y-1" data-testid="evidence-picker">
      <legend className="text-xs font-medium">Evidence events overlapping the period</legend>
      <DataState state={state} error={events.error} detail={state === 'empty' ? 'No events overlap this period; mark the cause as “no event” instead.' : undefined}>
        <ul className="max-h-40 space-y-1 overflow-y-auto">
          {items.map((event) => (
            <li key={event.id}>
              <label className="flex items-center gap-2">
                <Checkbox data-testid="evidence-event" data-event-id={event.id} checked={selected.includes(event.id)} onCheckedChange={(v) => toggle(event.id, v === true)} />
                <span>
                  <PlantTime iso={event.startTime} tz={timezone} /> → {event.endTime ? <PlantTime iso={event.endTime} tz={timezone} /> : 'open'} · {event.classification?.physicalType ?? event.eventType ?? 'event'}
                  {event.description ? ` · ${event.description}` : ''}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </DataState>
    </fieldset>
  );
}
