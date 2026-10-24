import { useState } from 'react';
import type { RcaEventDiagram } from '@/api/v2/types/rca';
import { FormField } from '@/features/ux-kit/form-field';
import { ToolDialog } from '../tool-dialog';
import { canConnect } from './diagram-model';

export interface ConnectionDialogProps {
  diagram: RcaEventDiagram;
  onAdd: (source: string, target: string) => void;
  onClose: () => void;
}

function EventSelect({ id, label, value, diagram, error, onChange }: { id: string; label: string; value: string; diagram: RcaEventDiagram; error?: string | null; onChange: (id: string) => void }) {
  return (
    <FormField id={id} label={label} required error={error}>
      <select id={id} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose an event</option>
        {diagram.nodes.map((node) => (
          <option key={node.id} value={node.id}>
            {node.label}
          </option>
        ))}
      </select>
    </FormField>
  );
}

/** F-10: the keyboard way to connect two events (cause → effect), the same as dragging between handles. */
export function ConnectionDialog({ diagram, onAdd, onClose }: ConnectionDialogProps) {
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const allowed = canConnect(diagram, source, target);
  const reason = source && target && !allowed ? (source === target ? 'Choose two different events.' : 'These events are already connected.') : null;
  return (
    <ToolDialog
      title="Add connection"
      info="Connect a cause to the event it led to; the same as dragging from an event's bottom handle to another event."
      submitLabel="Add connection"
      submitDisabled={!allowed}
      submitTestId="save-connection"
      onSubmit={() => onAdd(source, target)}
      onClose={onClose}
    >
      <EventSelect id="connection-from" label="From (cause)" value={source} diagram={diagram} onChange={setSource} />
      <EventSelect id="connection-to" label="To (effect)" value={target} diagram={diagram} error={reason} onChange={setTarget} />
    </ToolDialog>
  );
}
