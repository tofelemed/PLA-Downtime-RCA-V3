import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import type { BulkTarget, ProductionEventView } from '@/api/v2/types/events';
import { useAuth } from '@/contexts/AuthContext';
import type { EventFilterState } from '../model/event-filters';
import { parseEventFilters, toEventSearchParams } from '../model/event-url';
import { readWindowPreference, rememberWindow } from '../model/window-preference';

/** Dialogs of the list page; detail, create and edit are routes (`/events/:id`, `/events/new`, …/edit). */
export type EventHubDialog =
  | { kind: 'close'; event: ProductionEventView }
  | { kind: 'code'; event: ProductionEventView }
  | { kind: 'merge' }
  | { kind: 'bulk'; targets?: readonly BulkTarget[] }
  | { kind: 'select-all' }
  | null;

/**
 * Filters live in the URL (shareable, Back restores them); the default window is anchored to the
 * instant the page was opened and written to the URL once; it is the preset this user last chose in this
 * plant (remembered per browser), else the last 7 days. Selection (merge / bulk coding) and the
 * open dialog stay in memory.
 */
export function useEventHubState() {
  const [params, setParams] = useSearchParams();
  const userId = useAuth().session?.user.id ?? null;
  const tenantId = useV2TenantId();
  const [openedAt] = useState(() => Date.now());
  const preset = useMemo(() => readWindowPreference(userId, tenantId), [userId, tenantId]);
  const filters = useMemo(() => parseEventFilters(params, openedAt, preset), [params, openedAt, preset]);
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
      setParams(toEventSearchParams(next));
      setSelected(new Map());
    },
    [setParams, filters.windowLabel, userId, tenantId],
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
    dialog,
    openDialog: setDialog,
    closeDialog: useCallback(() => setDialog(null), []),
  };
}

export type EventHubState = ReturnType<typeof useEventHubState>;
