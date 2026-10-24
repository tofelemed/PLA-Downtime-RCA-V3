import { useState } from 'react';
import type { RcaLogicNode } from '@/api/v2/types/rca';
import { LOGIC_NODE_KINDS } from '../../../../model/analysis-settings';
import { ChoiceSelect, TextInputField } from '../tool-fields';
import { choicesOf } from '../tool-choices';
import { ToolDialog } from '../tool-dialog';

export type NodeFields = Pick<RcaLogicNode, 'label' | 'code' | 'kind' | 'description' | 'notes'>;

export interface NodeDialogProps {
  title: string;
  initial?: NodeFields;
  onSave: (fields: NodeFields) => void;
  onClose: () => void;
}

const empty: NodeFields = { label: '', code: null, kind: 'Equipment', description: null, notes: null };
const orNull = (value: string) => (value.trim() === '' ? null : value.trim());

/** Add or edit one logic-tree node: name, code, category, finding and note; a missing name is shown under its field. */
export function NodeDialog({ title, initial = empty, onSave, onClose }: NodeDialogProps) {
  const [fields, setFields] = useState({
    label: initial.label,
    code: initial.code ?? '',
    kind: initial.kind ?? '',
    description: initial.description ?? '',
    notes: initial.notes ?? '',
  });
  const [tried, setTried] = useState(false);
  const missing = fields.label.trim() === '';
  const save = () => {
    setTried(true);
    if (missing) return;
    onSave({ label: fields.label.trim(), code: orNull(fields.code), kind: orNull(fields.kind), description: orNull(fields.description), notes: orNull(fields.notes) });
  };
  return (
    <ToolDialog title={title} info="A failure, mode, hypothesis or cause of the logic tree." size="lg" submitLabel="Save node" submitTestId="save-node" onSubmit={save} onClose={onClose}>
      <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
        <TextInputField id="node-label" label="Name" value={fields.label} maxLength={500} required error={tried && missing ? 'Enter a name.' : null} onChange={(label) => setFields({ ...fields, label })} />
        <TextInputField id="node-code" label="Code" value={fields.code} maxLength={50} onChange={(code) => setFields({ ...fields, code })} />
      </div>
      <ChoiceSelect id="node-kind" label="Category" value={fields.kind} options={choicesOf(LOGIC_NODE_KINDS)} allowNone="No category" onChange={(kind) => setFields({ ...fields, kind })} />
      <TextInputField id="node-description" label="Analysis / finding" value={fields.description} maxLength={4000} multiline onChange={(description) => setFields({ ...fields, description })} />
      <TextInputField id="node-notes" label="Note" value={fields.notes} maxLength={4000} multiline onChange={(notes) => setFields({ ...fields, notes })} />
    </ToolDialog>
  );
}
