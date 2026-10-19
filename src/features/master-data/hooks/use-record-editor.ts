import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { friendlyToastContent } from '@/features/ux-kit/errors';
import { hasUnsavedChanges, useUnsavedChangesGuard } from '@/features/ux-kit/use-unsaved-changes-guard';
import { useToast } from '@/hooks/use-toast';
import type { RecordResource } from '../api/record-resource';
import { useChangeRecord, useCreateRecord } from '../api/use-record-commands';
import { compactErrors, fieldErrorsOf, type FieldErrors } from '../model/field-errors';

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
  /** "Unit", "Asset", … (toasts) */
  kind: string;
  /** page to open after a create; omitted (dialogs) = stay. Pages with it also ask before leaving unsaved edits. */
  detailPath?: (id: string) => string;
  /** server field → form field */
  fieldMap?: Readonly<Record<string, string>>;
}

/**
 * Draft, validation and save of a master-data form: create (then open the new record's page) or change
 * under If-Match. Field refusals (a duplicate code, an inactive unit) land next to their field, and every
 * refusal is also a friendly toast naming the refused fields ("Unexpected field: xyz" for a property the
 * server does not accept). The draft resets when the stored record changes revision.
 */
export function useRecordEditor<TDraft, TRecord extends Revisioned, TCreate, TChange>(
  options: RecordEditorOptions<TDraft, TRecord, TCreate, TChange>,
) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const create = useCreateRecord<TCreate, TRecord>(options.source);
  const change = useChangeRecord<TChange, TRecord>(options.source);
  const [draft, setDraft] = useState(options.initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const revision = options.record ? `${options.record.id}@${options.record.rowVersion}` : 'new';
  const [seenRevision, setSeenRevision] = useState(revision);
  if (revision !== seenRevision) {
    setSeenRevision(revision);
    setDraft(options.initial);
    setErrors({});
  }

  useUnsavedChangesGuard(hasUnsavedChanges(draft, options.initial, [!options.detailPath]));
  const patch = (next: Partial<TDraft>) => setDraft((current) => ({ ...current, ...next }));

  /** true when saved; false when the draft is invalid or the server refused it (messages shown) */
  const save = async (): Promise<boolean> => {
    const found = compactErrors(options.validate(draft));
    setErrors(found);
    if (Object.keys(found).length > 0) return false;
    try {
      if (options.record) {
        await change.submit({ record: options.record, body: options.toChange(draft, options.record) });
        toast({ title: `${options.kind} updated successfully` });
        return true;
      }
      const created = await create.submit(options.toCreate(draft));
      toast({ title: `${options.kind} created successfully` });
      if (options.detailPath) navigate(options.detailPath(created.id), { replace: true });
      return true;
    } catch (error) {
      setErrors(fieldErrorsOf(error, options.fieldMap));
      toast({ ...friendlyToastContent(error), variant: 'destructive' });
      return false;
    }
  };

  // dirty: the draft differs from the stored record (QA L4: "Save changes" waits for an edit)
  return { draft, patch, errors, save, dirty: hasUnsavedChanges(draft, options.initial), saving: create.isPending || change.isPending };
}
