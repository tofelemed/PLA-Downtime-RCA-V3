import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useSaveFeedback, type SaveSuccess } from '@/features/ux-kit/save-result';
import { hasUnsavedChanges, useUnsavedChangesGuard } from '@/features/ux-kit/use-unsaved-changes-guard';
import type { RecordResource } from '../api/record-resource';
import { useChangeRecord, useCreateRecord } from '../api/use-record-commands';
import { compactErrors, fieldErrorsOf, type FieldErrors } from '../model/field-errors';
import { createdRecordResult, type RecordListLink } from './record-save-result';

interface Revisioned {
  id: string;
  rowVersion: number;
}

export interface RecordEditorOptions<TDraft, TRecord extends Revisioned, TCreate, TChange> {
  source: RecordResource;
  /** the stored record, or null for a new one */
  record: TRecord | null;
  initial: TDraft;
  validate: (draft: TDraft) => FieldErrors;
  toCreate: (draft: TDraft) => TCreate;
  toChange: (draft: TDraft, record: TRecord) => TChange;
  /** "Unit", "Asset", … (result dialog and toasts) */
  kind: string;
  /** the record's page; omitted (dialogs) = stay. Pages with it also ask before leaving unsaved edits. */
  detailPath?: (id: string) => string;
  /** the list page; with `detailPath` a create ends in the result dialog (else a toast) */
  list?: RecordListLink;
  /** server field → form field */
  fieldMap?: Readonly<Record<string, string>>;
}

/** Draft, its saved baseline and field errors; all reset when the stored record changes revision. */
function useDraft<TDraft>(initial: TDraft, revision: string) {
  const [draft, setDraft] = useState(initial);
  const [saved, setSaved] = useState<TDraft | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [seenRevision, setSeenRevision] = useState(revision);
  const reset = () => {
    setDraft(initial);
    setSaved(null);
    setErrors({});
  };
  if (revision !== seenRevision) {
    setSeenRevision(revision);
    reset();
  }
  const baseline = saved ?? initial;
  return { draft, setDraft, errors, setErrors, baseline, markSaved: () => setSaved(draft), reset };
}

interface CreateFeedbackOptions {
  source: RecordResource;
  kind: string;
  detailPath?: (id: string) => string;
  list?: RecordListLink;
  /** "Add another": a fresh form */
  reset: () => void;
}

/**
 * How a create is reported: pages with a list get the result dialog; dialogs get a toast (a page without a
 * list: a toast, then the record's page).
 */
function useCreatedFeedback<TRecord extends Revisioned>({ source, kind, detailPath, list, reset }: CreateFeedbackOptions) {
  const navigate = useNavigate();
  const capabilities = useCapabilities();
  const success = (): SaveSuccess<TRecord> => {
    if (!detailPath || !list) return `${kind} created successfully`;
    return (created: TRecord) => createdRecordResult({
      source, kind, created, detailPath, list, capabilities, onAddAnother: reset,
      onDismiss: () => navigate(detailPath(created.id), { replace: true }),
    });
  };
  const afterCreate = (created: TRecord) => {
    if (detailPath && !list) navigate(detailPath(created.id), { replace: true });
  };
  return { success, afterCreate };
}

/**
 * Draft, validation and save of a master-data form (DECISIONS 2026-10-22 "Save feedback"). A create with a
 * `list` ends in the result dialog (View · Add another · Back to list · Next: <setup page>; dismissing it
 * opens the new record's page, so a second Create cannot duplicate it); an edit ends in a toast and the form
 * is clean again at once. A refusal is one red alert at the top of the form (`alert`) with the refused fields
 * marked (`errors`); the input stays. Render `alert` above the fields and `dialog` anywhere.
 */
export function useRecordEditor<TDraft, TRecord extends Revisioned, TCreate, TChange>(
  options: RecordEditorOptions<TDraft, TRecord, TCreate, TChange>,
) {
  const feedback = useSaveFeedback();
  const create = useCreateRecord<TCreate, TRecord>(options.source);
  const change = useChangeRecord<TChange, TRecord>(options.source);
  const state = useDraft(options.initial, options.record ? `${options.record.id}@${options.record.rowVersion}` : 'new');
  const { draft, baseline } = state;
  useUnsavedChangesGuard(hasUnsavedChanges(draft, baseline, [!options.detailPath]));
  const patch = (next: Partial<TDraft>) => state.setDraft((current) => ({ ...current, ...next }));
  const reset = () => { state.reset(); feedback.clearFailure(); };
  const created = useCreatedFeedback<TRecord>({ source: options.source, kind: options.kind, detailPath: options.detailPath, list: options.list, reset });

  const submit = async (): Promise<void> => {
    if (options.record) {
      const stored = options.record;
      await feedback.run(() => change.submit({ record: stored, body: options.toChange(draft, stored) }), `${options.kind} updated successfully`);
      return;
    }
    created.afterCreate(await feedback.run(() => create.submit(options.toCreate(draft)), created.success()));
  };

  /** true when saved; false when the draft is invalid or the server refused it (messages shown) */
  const save = async (): Promise<boolean> => {
    const found = compactErrors(options.validate(draft));
    state.setErrors(found);
    feedback.clearFailure();
    if (Object.keys(found).length > 0) return false;
    try {
      await submit();
      state.markSaved();
      return true;
    } catch (error) {
      state.setErrors(fieldErrorsOf(error, options.fieldMap));
      return false;
    }
  };

  // dirty: the draft differs from the stored (or just saved) values (QA L4: "Save changes" waits for an edit);
  // alert: the red alert of a refused save, for the top of the form; dialog: the result dialog of a create
  const { alert, dialog } = feedback;
  return { draft, patch, errors: state.errors, save, dirty: hasUnsavedChanges(draft, baseline), saving: create.isPending || change.isPending, alert, dialog };
}
