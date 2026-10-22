import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CAUSE_CATEGORY_LABELS } from '@/features/ux-kit/labels';
import type { CauseCategory, RcaCauseView } from '../api/master-data-types';
import { RCA_CAUSES } from '../api/record-resource';
import { useRecordEditor } from '../hooks/use-record-editor';
import { ChoiceField } from '../components/choice-field';
import { TextField } from '../components/text-field';
import { requiredText, textOrNull } from '../model/field-errors';

const CATEGORY_OPTIONS = Object.entries(CAUSE_CATEGORY_LABELS).map(([value, label]) => ({ value, label }));

interface CauseDraft {
  code: string;
  name: string;
  category: CauseCategory;
  description: string;
}

interface CauseBody {
  code: string;
  name: string;
  category: CauseCategory;
  description: string | null;
  parentId?: string;
}

export interface CauseDialogProps {
  /** the cause to edit, or null to add one */
  cause: RcaCauseView | null;
  /** parent of a new cause (null = top level) */
  parent: RcaCauseView | null;
  onClose: () => void;
}

const draftOf = (cause: RcaCauseView | null): CauseDraft => ({
  code: cause?.code ?? '',
  name: cause?.name ?? '',
  category: cause?.category ?? 'Equipment',
  description: cause?.description ?? '',
});

/** Add or edit one cause of the library (4 fields: a short dialog). Duplicate codes are refused on the field. */
export function CauseDialog({ cause, parent, onClose }: CauseDialogProps) {
  const bodyOf = (draft: CauseDraft): CauseBody => ({
    code: draft.code.trim(),
    name: draft.name.trim(),
    category: draft.category,
    description: textOrNull(draft.description),
    ...(parent ? { parentId: parent.id } : {}),
  });
  const editor = useRecordEditor<CauseDraft, RcaCauseView, CauseBody, CauseBody>({
    source: RCA_CAUSES,
    record: cause,
    initial: draftOf(cause),
    validate: (draft) => ({ code: requiredText(draft.code, 'Code'), name: requiredText(draft.name, 'Name') }),
    toCreate: bodyOf,
    toChange: (draft) => bodyOf(draft),
    kind: 'Cause',
  });
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (await editor.save()) onClose();
  };
  const { draft, errors, patch } = editor;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{cause ? `Edit ${cause.name}` : parent ? `Add a sub-cause to ${parent.name}` : 'Add cause'}</DialogTitle>
          <DialogDescription>Causes are grouped by category; codes are unique.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void submit(event)} className="space-y-4" noValidate>
          {editor.alert}
          <TextField id="cause-code" label="Code" value={draft.code} onChange={(code) => patch({ code })} error={errors.code} required />
          <TextField id="cause-name" label="Name" value={draft.name} onChange={(name) => patch({ name })} error={errors.name} required />
          <ChoiceField id="cause-category" label="Category" value={draft.category} onChange={(category) => patch({ category: category as CauseCategory })} options={CATEGORY_OPTIONS} />
          <TextField id="cause-description" label="Description" value={draft.description} onChange={(description) => patch({ description })} multiline />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={editor.saving}>
              {cause ? 'Save changes' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
