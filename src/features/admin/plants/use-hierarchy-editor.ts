import { useState, type FormEvent } from 'react';
import { StaleRevisionError, V2ApiError } from '@/api/v2/errors';
import type { UpdatePlantInput } from '@/api/v2/types/administration';
import { friendlyToastContent } from '@/features/ux-kit/errors';
import { hasUnsavedChanges, useUnsavedChangesGuard } from '@/features/ux-kit/use-unsaved-changes-guard';
import { useToast } from '@/hooks/use-toast';
import { HIERARCHY_FIELD_VOCABULARY } from './hierarchy-field-vocabulary';
import type { HierarchyFieldErrors, HierarchyFieldValues } from './hierarchy-fields';

/** What the edit page needs of an organization or plant (`GET /v2/organizations/:id`, `GET /v2/tenants/:id`). */
export interface EditableRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
  rowVersion: number;
  canEdit: boolean;
  timezone?: string | null;
  timezoneEditable?: boolean;
  timezoneLockedReason?: string | null;
}

export function valuesOf(record: EditableRecord): HierarchyFieldValues {
  return { code: record.code, name: record.name, description: record.description ?? '', timezone: record.timezone ?? '' };
}

/** The PATCH body: only what differs from the record read (a cleared description is sent as null). */
export function changesOf(values: HierarchyFieldValues, base: EditableRecord): UpdatePlantInput {
  const body: UpdatePlantInput = {};
  const name = values.name.trim();
  if (name !== base.name) body.name = name;
  const description = values.description.trim();
  if (description !== (base.description ?? '')) body.description = description === '' ? null : description;
  const timezone = values.timezone.trim();
  if (base.timezoneEditable && timezone !== '' && timezone !== (base.timezone ?? '')) body.timezone = timezone;
  return body;
}

export function validateEdit(values: HierarchyFieldValues, base: EditableRecord): HierarchyFieldErrors {
  const errors: HierarchyFieldErrors = {};
  if (!values.name.trim()) errors.name = 'Enter a name.';
  if (base.timezoneEditable && base.timezone && !values.timezone.trim()) errors.timezone = 'Choose the plant’s time zone.';
  return errors;
}

export interface HierarchyEditorOptions {
  record: EditableRecord;
  /** refetches the record (after a 412 or a time zone lock) */
  reload: () => Promise<EditableRecord | undefined>;
  save: (rowVersion: number, body: UpdatePlantInput) => Promise<EditableRecord>;
  /** after a successful save (null: nothing changed) */
  onSaved: (saved: EditableRecord | null) => Promise<void> | void;
  successText: string;
}

/**
 * State of an organization / plant edit form. Saves under the row version read; on 412 it loads the
 * latest version and keeps what the user typed (`conflict` tells the page to say so); on 409
 * TIMEZONE_LOCKED it reloads so the time zone shows as locked with the server's reason.
 */
export function useHierarchyEditor({ record, reload, save, onSaved, successText }: HierarchyEditorOptions) {
  const { toast } = useToast();
  const [base, setBase] = useState(record);
  const [values, setValues] = useState(() => valuesOf(record));
  const [errors, setErrors] = useState<HierarchyFieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const readOnly = !base.canEdit;
  useUnsavedChangesGuard(hasUnsavedChanges(values, valuesOf(base), [readOnly, busy]));
  const set = (patch: Partial<HierarchyFieldValues>) => setValues((current) => ({ ...current, ...patch }));

  const adoptLatest = async () => {
    const latest = await reload();
    if (latest) setBase(latest);
    if (latest && !latest.timezoneEditable) setValues((current) => ({ ...current, timezone: latest.timezone ?? '' }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validateEdit(values, base);
    setErrors(found);
    if (Object.keys(found).length) return;
    const body = changesOf(values, base);
    if (Object.keys(body).length === 0) return void onSaved(null);
    setBusy(true);
    try {
      const saved = await save(base.rowVersion, body);
      toast({ title: successText });
      await onSaved(saved);
    } catch (error) {
      setBusy(false);
      if (error instanceof StaleRevisionError) {
        setConflict(true);
        await adoptLatest();
        return;
      }
      toast({ ...friendlyToastContent(error, HIERARCHY_FIELD_VOCABULARY), variant: 'destructive' });
      if (error instanceof V2ApiError && error.code === 'TIMEZONE_LOCKED') await adoptLatest();
    }
  };

  return { base, values, errors, busy, conflict, readOnly, set, submit };
}
