import { useEventDuplicates, useEventIncident } from '@/api/v2/queries/stop-events';
import type { ProductionEventView } from '@/api/v2/types/events';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { DuplicatesSection } from './duplicates-section';
import { IncidentSection } from './incident-section';

/**
 * "Duplicates and repeats" of a stop (DT-04, SME D5): other records of the same stop (merged or suggested,
 * with undo) and the repeat-stop incident it belongs to. Every decision is made on the server.
 */
export function StopLinksPanel({ event }: { event: ProductionEventView }) {
  const duplicates = useEventDuplicates(event.id);
  const incident = useEventIncident(event.id);
  const { canWriteEvents } = useCapabilities();
  const live = event.states.physical === 'open' || event.states.physical === 'closed';
  return (
    <div className="space-y-4" data-testid="stop-links-panel">
      <section className="space-y-2" aria-labelledby="stop-duplicates-title">
        <h3 id="stop-duplicates-title" className="text-sm font-semibold">
          Same stop recorded elsewhere
        </h3>
        <DataState state={dataStateOf(duplicates)} error={duplicates.error} onRetry={() => void duplicates.refetch()}>
          {duplicates.data && <DuplicatesSection pairs={duplicates.data} eventId={event.id} canDecide={canWriteEvents} />}
        </DataState>
      </section>
      <section className="space-y-2" aria-labelledby="stop-incident-title">
        <h3 id="stop-incident-title" className="text-sm font-semibold">
          Repeat-stop incident
        </h3>
        <DataState state={dataStateOf(incident)} error={incident.error} onRetry={() => void incident.refetch()}>
          {incident.isSuccess && (
            <IncidentSection incident={incident.data} eventId={event.id} occurrenceId={event.occurrenceId} canDecide={canWriteEvents && live} />
          )}
        </DataState>
      </section>
    </div>
  );
}
