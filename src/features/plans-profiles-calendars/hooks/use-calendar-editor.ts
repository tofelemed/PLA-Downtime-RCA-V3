import { useState } from 'react';
import { hasUnsavedChanges, valuesDiffer } from '@/features/ux-kit/use-unsaved-changes-guard';
import { useSaveFeedback } from '@/features/ux-kit/save-result';
import { useCreateCalendarVersion, usePatchCalendarVersion, usePublishCalendarVersion } from '@/api/v2/queries/calendars';
import type { CalendarDefinition, CalendarPublishView, CalendarVersionView } from '@/api/v2/types/calendars';
import { calendarCreateBody, calendarPatchBody, definitionOf, draftOf, validateCalendarDraft, type CalendarDraft } from '../model/calendar-draft';
import type { FieldErrors } from '../model/profile-form';
import { refusalOf } from '../model/refusal';

export interface CalendarScope {
  siteId?: string;
  unitId?: string;
}

export interface PreviewCandidate {
  candidateVersionId?: string;
  candidateVersion?: CalendarDefinition;
}

/**
 * State and commands of one calendar editor: a new draft (create), a stored draft (PATCH with If-Match),
 * or a published version (read-only; publish = immutable, changes are a new version). A save ends in a
 * toast and a clean editor; a publish reports to the caller (the page shows the result dialog, which
 * outlives the editor's remount on the published version); a refusal of either is `failure`, input kept.
 */
export function useCalendarEditor(version: CalendarVersionView | null, seed: CalendarDraft, scope: CalendarScope) {
  const [initial] = useState<CalendarDraft>(() => (version ? draftOf(version) : seed));
  const [draft, setDraft] = useState<CalendarDraft>(initial);
  /** what is stored: the version as loaded, then the last saved draft */
  const [baseline, setBaseline] = useState<CalendarDraft>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const create = useCreateCalendarVersion();
  const patch = usePatchCalendarVersion();
  const publish = usePublishCalendarVersion();
  const saving = useSaveFeedback();
  const publishing = useSaveFeedback();
  const readOnly = version?.state === 'published';
  const dirty = !version || valuesDiffer(draft, baseline);

  const store = () => (version ? patch.submit({ version, body: calendarPatchBody(draft) }) : create.submit(calendarCreateBody(draft, scope)));

  const save = async (): Promise<CalendarVersionView | null> => {
    const found = validateCalendarDraft(draft);
    setErrors(found);
    publishing.clearFailure();
    if (Object.keys(found).length > 0) return null;
    const saved = await saving.run(store, 'Calendar draft saved').catch(() => null);
    if (saved) setBaseline(draft);
    return saved;
  };

  const publishStored = async (): Promise<CalendarPublishView | null> => {
    if (!version) return null;
    saving.clearFailure();
    return publishing.run(() => publish.submit({ id: version.id }), null).catch(() => null);
  };

  const candidate = (): PreviewCandidate | null => {
    if (version && !dirty) return { candidateVersionId: version.id };
    const found = validateCalendarDraft(draft);
    setErrors(found);
    return Object.keys(found).length > 0 ? null : { candidateVersion: definitionOf(draft) };
  };

  const serverErrors = refusalOf(saving.failure)?.fieldErrors ?? {};
  return {
    draft,
    /** typed into and not being saved: leaving asks first (QA P-5) */
    edited: hasUnsavedChanges(draft, baseline, [readOnly, create.isPending, patch.isPending]),
    setDraft,
    errors: { ...serverErrors, ...errors },
    readOnly,
    dirty,
    save,
    saving: create.isPending || patch.isPending,
    publishStored,
    publishing: publish.isPending,
    /** the refused save or publish, for the red alert at the top of the editor */
    failure: saving.failure ?? publishing.failure,
    candidate,
  };
}
