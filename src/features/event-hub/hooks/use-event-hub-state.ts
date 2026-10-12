import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ProductionEventView } from '@/api/v2/types/events';
import type { EventFilterState } from '../model/event-filters';
import { parseEventFilters, toEventSearchParams } from '../model/event-url';

/** Dialogs of the list page; detail, create and edit are routes (`/events/:id`, `/events/new`, …/edit). */
export type EventHubDialog = { kind: 'close'; event: ProductionEventView } | { kind: 'merge' } | { kind: 'bulk' } | null;

/**
 * Filters live in the URL (shareable, Back restores them); the default window is anchored to the
 * instant the page was opened and written to the URL once. Selection (merge / bulk coding) and the
 * open dialog stay in memory.
 */
export function useEventHubState() {
  const [params, setParams] = useSearchParams();
  const [openedAt] = useState(() => Date.now());
  const filters = useMemo(() => parseEventFilters(params, openedAt), [params, openedAt]);
  const [selected, setSelected] = useState<ReadonlyMap<string, ProductionEventView>>(new Map());
  const [dialog, setDialog] = useState<EventHubDialog>(null);

  useEffect(() => {
    if (!params.get('from') || !params.get('to')) setParams(toEventSearchParams(filters), { replace: true });
  }, [params, filters, setParams]);

  const toggle = useCallback((event: ProductionEventView, checked: boolean) => {
    setSelected((current) => {
      const next = new Map(current);
      if (checked) next.set(event.id, event);
      else next.delete(event.id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelected(new Map()), []);

  const changeFilters = useCallback(
    (next: EventFilterState) => {
      setParams(toEventSearchParams(next));
      setSelected(new Map());
    },
    [setParams],
  );

  const resetFilters = useCallback(() => {
    setParams(new URLSearchParams());
    setSelected(new Map());
  }, [setParams]);

  const selectedEvents = useMemo(() => [...selected.values()], [selected]);
  const selectedIds = useMemo(() => new Set(selected.keys()), [selected]);
  const sameUnit = selectedEvents.length > 1 && selectedEvents.every((event) => event.unitId === selectedEvents[0].unitId);

  return {
    filters,
    changeFilters,
    resetFilters,
    selectedIds,
    selectedEvents,
    canMerge: sameUnit,
    toggle,
    clearSelection,
    dialog,
    openDialog: setDialog,
    closeDialog: useCallback(() => setDialog(null), []),
  };
}

export type EventHubState = ReturnType<typeof useEventHubState>;
