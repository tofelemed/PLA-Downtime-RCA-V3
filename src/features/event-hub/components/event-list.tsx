import { useCallback } from 'react';
import type { ProductionEventView } from '@/api/v2/types/events';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { VirtualList } from '@/features/ux-kit/virtual-list';
import { EventListHeader, EventRow } from './event-row';

export interface EventListProps {
  events: ProductionEventView[];
  query: {
    isLoading: boolean;
    isError: boolean;
    error: unknown;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    fetchNextPage: () => unknown;
    refetch: () => unknown;
  };
  selectedIds: ReadonlySet<string>;
  onToggle: (event: ProductionEventView, checked: boolean) => void;
  onOpen: (event: ProductionEventView) => void;
  height?: number;
}

/** Virtualized keyset list (plan 3.2 step 2): only visible rows render; the end loads the next page. */
export function EventList({ events, query, selectedIds, onToggle, onOpen, height = 520 }: EventListProps) {
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  const state = dataStateOf(query, { isEmpty: events.length === 0 });

  return (
    <section aria-label="Events" className="rounded-md border" data-testid="event-list">
      <div className="overflow-x-auto">
        <div className="min-w-[50rem]">
          <EventListHeader />
          <DataState state={state} error={query.error} onRetry={() => query.refetch()}>
            <VirtualList
              items={events}
              rowHeight={56}
              height={height}
              getKey={(event) => event.id}
              onEndReached={loadMore}
              renderRow={(event) => (
                <EventRow
                  event={event}
                  selected={selectedIds.has(event.id)}
                  onToggle={(checked) => onToggle(event, checked)}
                  onOpen={() => onOpen(event)}
                />
              )}
            />
          </DataState>
        </div>
      </div>
      <p className="px-2 py-1 text-xs text-muted-foreground" aria-live="polite">
        {events.length} loaded{hasNextPage ? ' · scroll for more' : ''}
        {isFetchingNextPage ? ' · loading…' : ''}
      </p>
    </section>
  );
}
