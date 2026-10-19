import { useState } from 'react';
import { hasUnsavedChanges } from '@/features/ux-kit/use-unsaved-changes-guard';
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
 * or a published version (read-only; publish = immutable, changes are a new version).
 */
export function useCalendarEditor(version: CalendarVersionView | null, seed: CalendarDraft, scope: CalendarScope) {
  const [initial] = useState<CalendarDraft>(() => (version ? draftOf(version) : seed));
  const [draft, setDraft] = useState<CalendarDraft>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [published, setPublished] = useState<CalendarPublishView | null>(null);
  const create = useCreateCalendarVersion();
  const patch = usePatchCalendarVersion();
  const publish = usePublishCalendarVersion();
  const readOnly = version?.state === 'published';
  const dirty = !version || JSON.stringify(draft) !== JSON.stringify(draftOf(version));
  const saveError = version ? patch.error : create.error;

  const save = async (): Promise<CalendarVersionView | null> => {
    const found = validateCalendarDraft(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) return null;
    if (version) return patch.submit({ version, body: calendarPatchBody(draft) }).catch(() => null);
    return create.submit(calendarCreateBody(draft, scope)).catch(() => null);
  };

  const publishStored = async () => {
    if (!version) return null;
    const result = await publish.submit({ id: version.id }).catch(() => null);
    setPublished(result);
    return result;
  };

  const candidate = (): PreviewCandidate | null => {
    if (version && !dirty) return { candidateVersionId: version.id };
    const found = validateCalendarDraft(draft);
    setErrors(found);
    return Object.keys(found).length > 0 ? null : { candidateVersion: definitionOf(draft) };
  };

  const serverErrors = refusalOf(saveError)?.fieldErrors ?? {};
  return {
    draft,
    /** typed into and not being saved: leaving asks first (QA P-5) */
    edited: hasUnsavedChanges(draft, initial, [readOnly, create.isPending, patch.isPending]),
    setDraft,
    errors: { ...serverErrors, ...errors },
    readOnly,
    dirty,
    save,
    saving: create.isPending || patch.isPending,
    saveError,
    publishStored,
    publishing: publish.isPending,
    publishError: publish.error,
    published,
    candidate,
  };
}
