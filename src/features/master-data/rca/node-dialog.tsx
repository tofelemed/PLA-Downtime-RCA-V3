import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CAUSE_CATEGORY_LABELS } from '@/features/ux-kit/labels';
import type { CauseCategory } from '../api/master-data-types';
import { ChoiceField } from '../components/choice-field';
import { COMPACT_FIELDS } from '../components/compact-fields';
import { TextField } from '../components/text-field';
import { compactErrors, requiredText, type FieldErrors } from '../model/field-errors';
import type { NodeFields } from './logic-tree-model';

const CATEGORY_OPTIONS = Object.entries(CAUSE_CATEGORY_LABELS).map(([value, label]) => ({ value, label }));

export interface NodeDialogProps {
  title: string;
  initial: NodeFields;
  /** codes already used by other nodes of the tree (a node code must be unique in its template) */
  takenCodes: ReadonlySet<string>;
  onSubmit: (fields: NodeFields) => void;
  onClose: () => void;
}

/** Add or edit one logic-tree node: name, code, category, description (a short Radix dialog). */
export function NodeDialog({ title, initial, takenCodes, onSubmit, onClose }: NodeDialogProps) {
  const [fields, setFields] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const code = fields.code.trim();
    const found = compactErrors({
      name: requiredText(fields.name, 'Name'),
      code: requiredText(code, 'Code') ?? (takenCodes.has(code.toLowerCase()) ? 'Another node of this tree already uses this code.' : undefined),
    });
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    onSubmit({ ...fields, name: fields.name.trim(), code });
    onClose();
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className={`space-y-4 ${COMPACT_FIELDS}`} noValidate>
          <TextField id="node-name" label="Name" value={fields.name} onChange={(name) => setFields({ ...fields, name })} error={errors.name} required />
          <TextField id="node-code" label="Code" value={fields.code} onChange={(code) => setFields({ ...fields, code })} error={errors.code} required />
          <ChoiceField
            id="node-category"
            label="Category"
            value={fields.category}
            onChange={(category) => setFields({ ...fields, category: category as CauseCategory })}
            options={CATEGORY_OPTIONS}
          />
          <TextField id="node-description" label="Description" value={fields.description} onChange={(description) => setFields({ ...fields, description })} multiline />
          <DialogFooter>
            <Button type="button" variant="outline" className="h-9" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="h-9">Apply</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
