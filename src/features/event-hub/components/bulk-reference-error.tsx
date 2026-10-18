import type { BulkTarget } from '@/api/v2/types/events';
import { usePlantFormat } from '../hooks/use-plant-format';
import { invalidReferenceIds } from '../model/bulk-targets';
import { useEventHubEnv } from '../use-event-hub-env';

/**
 * A-1: the bulk asset is not equipment of every chosen event's unit — the events the server named, by unit
 * and start (their id beside it), so the user can narrow the selection.
 */
export function BulkReferenceError({ error, events }: { error: unknown; events: readonly BulkTarget[] }) {
  const env = useEventHubEnv();
  const { dateTime } = usePlantFormat();
  const ids = invalidReferenceIds(error);
  if (ids.length === 0) return null;
  const byId = new Map(events.map((event) => [event.id, event]));
  return (
    <div className="text-sm text-destructive" data-testid="bulk-invalid-reference">
      <p>The asset is not equipment of these events’ unit:</p>
      <ul className="list-disc pl-5">
        {ids.map((id) => {
          const event = byId.get(id);
          return (
            <li key={id} data-event-id={id}>
              {event ? `${env.unitName(event.unitId)}, ${dateTime(event.startTime)}` : 'An event no longer listed'}{' '}
              <span className="font-mono text-xs text-muted-foreground">({id})</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
