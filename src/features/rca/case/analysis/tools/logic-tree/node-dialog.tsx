import { useState } from 'react';
import type { RcaLogicNode } from '@/api/v2/types/rca';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LOGIC_NODE_KINDS } from '../../../../model/analysis-settings';
import { AreaField, ChoiceField, optionsOf, TextField } from '../../../evidence/form-controls';

export type NodeFields = Pick<RcaLogicNode, 'label' | 'code' | 'kind' | 'description' | 'notes'>;

export interface NodeDialogProps {
  title: string;
  initial?: NodeFields;
  onSave: (fields: NodeFields) => void;
  onClose: () => void;
}

const empty: NodeFields = { label: '', code: null, kind: 'Equipment', description: null, notes: null };
const orNull = (value: string) => (value.trim() === '' ? null : value.trim());

/** Add or edit one logic-tree node: name, code, category, finding and note. */
export function NodeDialog({ title, initial = empty, onSave, onClose }: NodeDialogProps) {
  const [fields, setFields] = useState({
    label: initial.label,
    code: initial.code ?? '',
    kind: initial.kind ?? '',
    description: initial.description ?? '',
    notes: initial.notes ?? '',
  });
  const save = () => onSave({ label: fields.label.trim(), code: orNull(fields.code), kind: orNull(fields.kind), description: orNull(fields.description), notes: orNull(fields.notes) });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>A failure, mode, hypothesis or cause of the logic tree.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <TextField id="node-label" label="Name" value={fields.label} maxLength={500} required onChange={(label) => setFields({ ...fields, label })} />
          <TextField id="node-code" label="Code" value={fields.code} maxLength={50} onChange={(code) => setFields({ ...fields, code })} />
          <ChoiceField id="node-kind" label="Category" value={fields.kind} options={optionsOf(LOGIC_NODE_KINDS)} allowNone="No category" onChange={(kind) => setFields({ ...fields, kind })} />
          <AreaField id="node-description" label="Analysis / finding" value={fields.description} maxLength={4000} onChange={(description) => setFields({ ...fields, description })} />
          <AreaField id="node-notes" label="Note" value={fields.notes} maxLength={4000} onChange={(notes) => setFields({ ...fields, notes })} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={fields.label.trim() === ''} onClick={save} data-testid="save-node">
            Save node
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
