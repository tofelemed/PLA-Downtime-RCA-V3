import { useState } from 'react';
import type { RcaEventDiagram } from '@/api/v2/types/rca';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/features/ux-kit/form-field';
import { canConnect } from './diagram-model';

export interface ConnectionDialogProps {
  diagram: RcaEventDiagram;
  onAdd: (source: string, target: string) => void;
  onClose: () => void;
}

function EventSelect({ id, label, value, diagram, onChange }: { id: string; label: string; value: string; diagram: RcaEventDiagram; onChange: (id: string) => void }) {
  return (
    <FormField id={id} label={label} required>
      <select id={id} className="h-10 w-full rounded border bg-background px-2 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add connection</DialogTitle>
          <DialogDescription>Connect a cause to the event it led to.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <EventSelect id="connection-from" label="From (cause)" value={source} diagram={diagram} onChange={setSource} />
          <EventSelect id="connection-to" label="To (effect)" value={target} diagram={diagram} onChange={setTarget} />
          {reason && (
            <p role="alert" className="text-sm text-destructive">
              {reason}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!allowed} onClick={() => onAdd(source, target)} data-testid="save-connection">
            Add connection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
