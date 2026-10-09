import { useCallback, useState } from 'react';
import type { ProductionEventView } from '@/api/v2/types/events';
import { defaultFilters, presetWindow, WINDOW_PRESETS, type EventFilterState } from '../model/event-filters';

export type EventHubDialog =
  | { kind: 'form'; eventId: string | null }
  | { kind: 'split'; event: ProductionEventView }
  | { kind: 'close'; event: ProductionEventView }
  | { kind: 'merge' }
  | { kind: 'bulk' }
  | null;

const DEFAULT_PRESET = WINDOW_PRESETS[1];

function initialFilters(): EventFilterState {
  return defaultFilters(presetWindow(DEFAULT_PRESET.hours, DEFAULT_PRESET.label, Date.now()));
}

/** Screen state of the Event Hub: filters, selection (for merge / bulk coding), drawer and dialogs. */
export function useEventHubState() {
  const [filters, setFilters] = useState<EventFilterState>(initialFilters);
  const [selected, setSelected] = useState<ReadonlyMap<string, ProductionEventView>>(new Map());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<EventHubDialog>(null);

  const toggle = useCallback((event: ProductionEventView, checked: boolean) => {
    setSelected((current) => {
      const next = new Map(current);
      if (checked) next.set(event.id, event);
      else next.delete(event.id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelected(new Map()), []);

  const changeFilters = useCallback((next: EventFilterState) => {
    setFilters(next);
    setSelected(new Map());
  }, []);

  const selectedEvents = [...selected.values()];
  const sameUnit = selectedEvents.length > 1 && selectedEvents.every((event) => event.unitId === selectedEvents[0].unitId);

  return {
    filters,
    changeFilters,
    resetFilters: () => changeFilters(initialFilters()),
    selectedIds: new Set(selected.keys()),
    selectedEvents,
    canMerge: sameUnit,
    toggle,
    clearSelection,
    detailId,
    openDetail: setDetailId,
    dialog,
    openDialog: setDialog,
    closeDialog: () => setDialog(null),
  };
}
