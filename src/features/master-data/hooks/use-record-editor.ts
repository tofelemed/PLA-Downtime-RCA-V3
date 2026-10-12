import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { V2ApiError } from '@/api/v2/errors';
import { friendlyToastContent } from '@/features/ux-kit/errors';
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
  /** page to open after a create; omitted (dialogs) = stay */
  detailPath?: (id: string) => string;
  /** server field → form field */
  fieldMap?: Readonly<Record<string, string>>;
}

/**
 * Draft, validation and save of a master-data form: create (then open the new record's page) or change
 * under If-Match. Field refusals (a duplicate code, an inactive unit) land next to their field; anything
 * else is a friendly toast. The draft resets when the stored record changes revision.
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
      const fields = fieldErrorsOf(error, options.fieldMap);
      setErrors(fields);
      if (Object.keys(fields).length === 0 || !(error instanceof V2ApiError)) {
        toast({ ...friendlyToastContent(error), variant: 'destructive' });
      }
      return false;
    }
  };

  return { draft, patch, errors, save, saving: create.isPending || change.isPending };
}
