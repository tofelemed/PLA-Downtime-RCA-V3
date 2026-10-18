import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import type { BulkTarget, ProductionEventView } from '@/api/v2/types/events';
import { useAuth } from '@/contexts/AuthContext';
import type { EventFilterState } from '../model/event-filters';
import { hasAbsoluteWindow, hasWindowParams, parseEventFilters, toEventSearchParams } from '../model/event-url';
import { readWindowPreference, rememberWindow } from '../model/window-preference';
import { useWindowClock } from './use-window-clock';

/** Dialogs of the list page; detail, create and edit are routes (`/events/:id`, `/events/new`, …/edit). */
export type EventHubDialog =
  | { kind: 'close'; event: ProductionEventView }
  | { kind: 'code'; event: ProductionEventView }
  | { kind: 'merge' }
  | { kind: 'bulk'; targets?: readonly BulkTarget[] }
  | { kind: 'select-all' }
  | null;

/**
 * Filters live in the URL (shareable, Back restores them). A rolling window is stored as its key
 * (`window=24h`) and resolved from a clock that moves on while the page is open (A-5), so the list keeps
 * showing new stops; a missing window becomes the preset this user last chose in this plant (remembered
 * per browser), else the last 7 days. Selection (merge / bulk coding) and the open dialog stay in memory.
 */
export function useEventHubState() {
  const [params, setParams] = useSearchParams();
  const userId = useAuth().session?.user.id ?? null;
  const tenantId = useV2TenantId();
  const [now, refreshWindow] = useWindowClock(!hasAbsoluteWindow(params));
  const preset = useMemo(() => readWindowPreference(userId, tenantId), [userId, tenantId]);
  const filters = useMemo(() => parseEventFilters(params, now, preset), [params, now, preset]);
  const [selected, setSelected] = useState<ReadonlyMap<string, ProductionEventView>>(new Map());
  const [dialog, setDialog] = useState<EventHubDialog>(null);

  useEffect(() => {
    if (!hasWindowParams(params)) setParams(toEventSearchParams(filters), { replace: true });
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

  /** E-6: one event leaves the selection (after a single-row command moved its row version on). */
  const deselect = useCallback((eventId: string) => {
    setSelected((current) => {
      if (!current.has(eventId)) return current;
      const next = new Map(current);
      next.delete(eventId);
      return next;
    });
  }, []);

  /** FE-07: tick or untick every listed row at once (the rows loaded so far). */
  const toggleMany = useCallback((events: readonly ProductionEventView[], checked: boolean) => {
    setSelected((current) => {
      const next = new Map(current);
      for (const event of events) {
        if (checked) next.set(event.id, event);
        else next.delete(event.id);
      }
      return next;
    });
  }, []);

  const changeFilters = useCallback(
    (next: EventFilterState) => {
      if (next.windowLabel !== filters.windowLabel) rememberWindow(userId, tenantId, next.windowLabel);
      if (next.relativeWindow && next.relativeWindow !== filters.relativeWindow) refreshWindow();
      setParams(toEventSearchParams(next));
      setSelected(new Map());
    },
    [setParams, filters.windowLabel, filters.relativeWindow, userId, tenantId, refreshWindow],
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
    toggleMany,
    clearSelection,
    deselect,
    dialog,
    openDialog: setDialog,
    closeDialog: useCallback(() => setDialog(null), []),
  };
}

export type EventHubState = ReturnType<typeof useEventHubState>;
