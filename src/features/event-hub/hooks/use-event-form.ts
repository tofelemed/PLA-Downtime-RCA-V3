import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ProductionEventView } from '@/api/v2/types/events';
import { draftKey, draftStore, type EventDraft } from '../model/event-draft';
import { EMPTY_FORM, formValuesOf, type EventFormValues, type FieldErrors } from '../model/event-form';

export interface UseEventFormOptions {
  tenantId: string;
  /** null = create */
  event: ProductionEventView | null;
  timezone: string;
  /** prefill of a new event (e.g. the unit chosen in the filters) */
  defaults?: Partial<EventFormValues>;
}

function startDraft(options: UseEventFormOptions): EventDraft {
  const stored = draftStore.read(draftKey(options.tenantId, options.event?.id ?? null));
  if (stored) return stored;
  const initial = options.event ? formValuesOf(options.event, options.timezone) : { ...EMPTY_FORM, ...options.defaults };
  return { baseRevision: options.event?.rowVersion ?? null, initial, values: initial };
}

/**
 * Form state of the event dialog: restores a stored draft, keeps every change in the draft store, and
 * reports when the server's revision moved past the one the edit started from (conflict review needed).
 */
export function useEventForm(options: UseEventFormOptions) {
  const key = draftKey(options.tenantId, options.event?.id ?? null);
  const [draft, setDraft] = useState<EventDraft>(() => startDraft(options));
  const [restored] = useState(() => draftStore.read(key) !== null);
  const [errors, setErrors] = useState<FieldErrors>({});
  // set once the draft is saved or discarded: a late state update must not store it again
  const finished = useRef(false);

  useEffect(() => {
    if (!finished.current && draft.values !== draft.initial) draftStore.write(key, draft);
  }, [key, draft]);

  const setField = useCallback(<F extends keyof EventFormValues>(field: F, value: EventFormValues[F]) => {
    setDraft((current) => ({ ...current, values: { ...current.values, [field]: value } }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }, []);

  /** after a conflict review: the server's latest revision becomes the new base, the user's values stay */
  const rebase = useCallback((event: ProductionEventView) => {
    setDraft((current) => ({ ...current, baseRevision: event.rowVersion }));
  }, []);

  const discard = useCallback(() => {
    finished.current = true;
    draftStore.clear(key);
  }, [key]);

  const serverRevision = options.event?.rowVersion ?? null;
  const serverChanged = useMemo(
    () => draft.baseRevision !== null && serverRevision !== null && serverRevision !== draft.baseRevision,
    [draft.baseRevision, serverRevision],
  );

  return { draft, values: draft.values, setField, errors, setErrors, restored, serverChanged, rebase, discard };
}

export type EventFormState = ReturnType<typeof useEventForm>;
