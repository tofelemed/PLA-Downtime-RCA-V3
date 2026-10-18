import { useEventDuplicates } from '@/api/v2/queries/stop-events';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DuplicatesSection } from '@/features/event-hub/stop-links/duplicates-section';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import type { InlineFormProps } from './inline-form-props';
import { useDecidedWhen } from './use-decided-when';

/** A suggested duplicate stop on the approval page: merge or keep both, with the event page's reasoned confirmations. */
export function StopMergeDecision({ item, onDecided }: InlineFormProps) {
  const { canWriteEvents } = useCapabilities();
  const eventId = item.target.eventId;
  const query = useEventDuplicates(eventId);
  const pair = query.data?.find((candidate) => candidate.id === item.id);
  useDecidedWhen(pair ? pair.state === 'suggested' : undefined, pair?.state === 'merged' ? 'Stops merged' : 'Both stops kept', onDecided);
  return (
    <DataState state={dataStateOf(query)} error={query.error} onRetry={() => void query.refetch()}>
      {pair && eventId && (
        <div data-testid="inline-stop-merge">
          <DuplicatesSection pairs={[pair]} eventId={eventId} canDecide={canWriteEvents} />
          {!canWriteEvents && <p className="text-sm text-muted-foreground">Your role can read stops but not merge them.</p>}
        </div>
      )}
      {query.isSuccess && !pair && <p className="text-sm">This suggestion is not open any more.</p>}
    </DataState>
  );
}
