import { useState } from 'react';
import type { RcaDiagramNode } from '@/api/v2/types/rca';
import { DateTimeInput } from '@/features/ux-kit/date-inputs';
import { DIAGRAM_EVENT_TYPES } from '../../../../model/analysis-settings';
import { SEVERITIES } from '../../../../model/evidence-form';
import { useRcaFormat } from '../../../../use-rca-format';
import { ChoiceSelect, TextInputField } from '../tool-fields';
import { choicesOf } from '../tool-choices';
import { ToolDialog } from '../tool-dialog';

export type EventFields = Pick<RcaDiagramNode, 'label' | 'type' | 'timestamp' | 'description' | 'asset' | 'severity'>;

const EMPTY: EventFields = { label: '', type: 'Failure', timestamp: null, description: null, asset: null, severity: 'Medium' };

/** Add or edit one event of the diagram / timeline (what, kind, when, where, how severe); a missing "what" is shown under its field. */
export function EventDialog({ title, initial = EMPTY, onSave, onClose }: { title: string; initial?: EventFields; onSave: (fields: EventFields) => void; onClose: () => void }) {
  const { timezone } = useRcaFormat();
  const [fields, setFields] = useState<EventFields>(initial);
  const [tried, setTried] = useState(false);
  const set = (patch: Partial<EventFields>) => setFields((current) => ({ ...current, ...patch }));
  const missing = fields.label.trim() === '';
  const save = () => {
    setTried(true);
    if (!missing) onSave({ ...fields, label: fields.label.trim() });
  };
  return (
    <ToolDialog title={title} info="An event before or during the failure (alarm, action, inspection …)." size="lg" submitLabel="Save event" submitTestId="save-event" onSubmit={save} onClose={onClose}>
      <TextInputField id="event-label" label="What happened" value={fields.label} maxLength={255} required error={tried && missing ? 'Describe what happened.' : null} onChange={(label) => set({ label })} />
      <div className="grid gap-3 md:grid-cols-2">
        <ChoiceSelect id="event-type" label="Kind" value={fields.type ?? ''} options={choicesOf(DIAGRAM_EVENT_TYPES)} onChange={(type) => set({ type })} />
        <ChoiceSelect id="event-severity" label="Severity" value={fields.severity ?? ''} options={choicesOf(SEVERITIES)} onChange={(severity) => set({ severity })} />
        <DateTimeInput label="When" value={fields.timestamp} timeZone={timezone} onChange={(timestamp) => set({ timestamp })} />
        <TextInputField id="event-asset" label="Asset or unit" value={fields.asset ?? ''} maxLength={255} onChange={(asset) => set({ asset: asset || null })} />
      </div>
      <TextInputField id="event-description" label="Description" value={fields.description ?? ''} maxLength={2000} multiline onChange={(description) => set({ description: description || null })} />
    </ToolDialog>
  );
}
