import { useState } from 'react';
import type { RcaDiagramNode } from '@/api/v2/types/rca';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DateTimeInput } from '@/features/ux-kit/date-inputs';
import { DIAGRAM_EVENT_TYPES } from '../../../../model/analysis-settings';
import { SEVERITIES } from '../../../../model/evidence-form';
import { useRcaFormat } from '../../../../use-rca-format';
import { AreaField, ChoiceField, optionsOf, TextField } from '../../../evidence/form-controls';

export type EventFields = Pick<RcaDiagramNode, 'label' | 'type' | 'timestamp' | 'description' | 'asset' | 'severity'>;

const EMPTY: EventFields = { label: '', type: 'Failure', timestamp: null, description: null, asset: null, severity: 'Medium' };

/** Add or edit one event of the diagram / timeline (what, kind, when, where, how severe). */
export function EventDialog({ title, initial = EMPTY, onSave, onClose }: { title: string; initial?: EventFields; onSave: (fields: EventFields) => void; onClose: () => void }) {
  const { timezone } = useRcaFormat();
  const [fields, setFields] = useState<EventFields>(initial);
  const set = (patch: Partial<EventFields>) => setFields((current) => ({ ...current, ...patch }));
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>An event before or during the failure (alarm, action, inspection …).</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <TextField id="event-label" label="What happened" value={fields.label} maxLength={255} required onChange={(label) => set({ label })} />
          <ChoiceField id="event-type" label="Kind" value={fields.type ?? ''} options={optionsOf(DIAGRAM_EVENT_TYPES)} onChange={(type) => set({ type })} />
          <DateTimeInput label="When" value={fields.timestamp} timeZone={timezone} onChange={(timestamp) => set({ timestamp })} />
          <TextField id="event-asset" label="Asset or unit" value={fields.asset ?? ''} maxLength={255} onChange={(asset) => set({ asset: asset || null })} />
          <ChoiceField id="event-severity" label="Severity" value={fields.severity ?? ''} options={optionsOf(SEVERITIES)} onChange={(severity) => set({ severity })} />
          <AreaField id="event-description" label="Description" value={fields.description ?? ''} maxLength={2000} onChange={(description) => set({ description: description || null })} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={fields.label.trim() === ''} onClick={() => onSave({ ...fields, label: fields.label.trim() })} data-testid="save-event">
            Save event
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
