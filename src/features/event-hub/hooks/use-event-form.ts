import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ProductionEventView } from '@/api/v2/types/events';
import { draftKey, draftStore, newDraftStart, type EventDraft } from '../model/event-draft';
import { EMPTY_FORM, formValuesOf, type EventFormValues, type FieldErrors } from '../model/event-form';

export interface UseEventFormOptions {
  /** the signed-in user: drafts are per user, plant and event */
  userId: string;
  tenantId: string;
  /** null = create */
  event: ProductionEventView | null;
  timezone: string;
  /** prefill of a new event (e.g. the unit chosen in the filters) */
  defaults?: Partial<EventFormValues>;
}

/** Drafts stored before a field existed get its empty value (the form never holds `undefined`). */
const complete = (draft: EventDraft): EventDraft => ({
  ...draft,
  initial: { ...EMPTY_FORM, ...draft.initial },
  values: { ...EMPTY_FORM, ...draft.values },
});

interface DraftStart {
  draft: EventDraft;
  restored: boolean;
  /** E-9: a recent new-event draft of another unit, offered instead of restored */
  offered: EventDraft | null;
}

function startEditDraft(event: ProductionEventView, timezone: string, stored: EventDraft | null): DraftStart {
  if (stored) return { draft: complete(stored), restored: true, offered: null };
  const initial = formValuesOf(event, timezone);
  return { draft: { baseRevision: event.rowVersion, initial, values: initial }, restored: false, offered: null };
}

function startNewDraft(defaults: Partial<EventFormValues>, key: string, stored: EventDraft | null): DraftStart {
  const start = newDraftStart(stored, defaults.unitId ?? '', Date.now());
  if (start.kind === 'restore') return { draft: complete(start.draft), restored: true, offered: null };
  if (stored && start.kind === 'fresh') draftStore.clear(key);
  const initial = { ...EMPTY_FORM, ...defaults };
  return { draft: { baseRevision: null, initial, values: initial }, restored: false, offered: start.kind === 'ask' ? complete(start.draft) : null };
}

function startDraft(options: UseEventFormOptions, key: string): DraftStart {
  const stored = draftStore.read(key);
  return options.event ? startEditDraft(options.event, options.timezone, stored) : startNewDraft(options.defaults ?? {}, key, stored);
}

/**
 * Form state of the event form: restores a stored draft (a new-event draft only within 12 h, and only for
 * the unit the page was opened for — otherwise it is offered), keeps every change in the draft store,
 * and reports when the server's revision moved past the one the edit started from (conflict review).
 */
export function useEventForm(options: UseEventFormOptions) {
  const key = draftKey(options.userId, options.tenantId, options.event?.id ?? null);
  const [start] = useState(() => startDraft(options, key));
  const [draft, setDraft] = useState<EventDraft>(start.draft);
  const [restored, setRestored] = useState(start.restored);
  const [offered, setOffered] = useState<EventDraft | null>(start.offered);
  const [errors, setErrors] = useState<FieldErrors>({});
  // set once the draft is saved or discarded: a late state update must not store it again
  const finished = useRef(false);

  useEffect(() => {
    if (!finished.current && draft.values !== draft.initial) draftStore.write(key, draft);
  }, [key, draft]);

  const setField = useCallback(<F extends keyof EventFormValues>(field: F, value: EventFormValues[F]) => {
    setDraft((current) => ({ ...current, values: { ...current.values, [field]: value } }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setOffered(null);
  }, []);

  /** E-9 "Resume draft": the offered draft replaces the fresh form. */
  const resumeOffered = useCallback(() => {
    if (!offered) return;
    setDraft(offered);
    setRestored(true);
    setOffered(null);
  }, [offered]);

  /** E-9 "Start new": the offered draft is dropped. */
  const dropOffered = useCallback(() => {
    draftStore.clear(key);
    setOffered(null);
  }, [key]);

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

  return { draft, values: draft.values, setField, errors, setErrors, restored, serverChanged, rebase, discard, offered, resumeOffered, dropOffered };
}

export type EventFormState = ReturnType<typeof useEventForm>;
