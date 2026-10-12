import { useRcaEvidenceOptions } from '@/api/v2/queries/rca-cases';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { DateInput, DateTimeInput } from '@/features/ux-kit/date-inputs';
import { Section } from '@/features/ux-kit/page-layout';
import { useAssetOptions } from '../../use-asset-options';
import { EVIDENCE_TYPES, FIVE_P, SEVERITIES, type EvidenceForm } from '../../model/evidence-form';
import { useRcaFormat } from '../../use-rca-format';
import { AreaField, ChoiceField, optionsOf, TextField, type ChoiceOption } from './form-controls';

export interface EvidenceFieldsProps {
  form: EvidenceForm;
  onChange: (patch: Partial<EvidenceForm>) => void;
}

/** Title, type, description, source and when / where it was observed. */
export function EvidenceDetailsFields({ form, onChange }: EvidenceFieldsProps) {
  const { timezone } = useRcaFormat();
  const assets = useAssetOptions();
  return (
    <Section title="Details" headingLevel={3}>
      <div className="grid gap-4 md:grid-cols-2">
        <TextField id="ev-title" label="Title" value={form.title} maxLength={255} required onChange={(title) => onChange({ title })} wide />
        <ChoiceField id="ev-type" label="Type" value={form.type} options={optionsOf(EVIDENCE_TYPES)} onChange={(type) => onChange({ type })} />
        <TextField id="ev-source" label="Source (tag, document, photo reference)" value={form.source} maxLength={500} onChange={(source) => onChange({ source })} />
        <AreaField id="ev-description" label="Description" value={form.description} maxLength={4000} onChange={(description) => onChange({ description })} />
        <DateTimeInput label="Observed at" value={form.occurredAt} timeZone={timezone} onChange={(occurredAt) => onChange({ occurredAt })} />
        <ChoiceField id="ev-asset" label="Related asset" value={form.assetId} options={assets} allowNone="No asset" onChange={(assetId) => onChange({ assetId })} />
      </div>
    </Section>
  );
}

/** 5P, severity, category, location, tags and the verified flag. */
export function EvidenceClassificationFields({ form, onChange }: EvidenceFieldsProps) {
  const options = useRcaEvidenceOptions();
  const categories = optionsOf(options.data?.categories ?? []);
  const locations = optionsOf(options.data?.locations ?? []);
  const keep = (list: ChoiceOption[], value: string): ChoiceOption[] => (value && !list.some((o) => o.value === value) ? [...list, { value, label: value }] : list);
  return (
    <Section title="Classification" headingLevel={3}>
      <div className="grid gap-4 md:grid-cols-2">
        <ChoiceField id="ev-fivep" label="5P category" value={form.fiveP} options={optionsOf(FIVE_P)} onChange={(fiveP) => onChange({ fiveP })} />
        <ChoiceField id="ev-severity" label="Severity" value={form.severity} options={optionsOf(SEVERITIES)} onChange={(severity) => onChange({ severity })} />
        <ChoiceField id="ev-category" label="Category" value={form.category} options={keep(categories, form.category)} allowNone="No category" onChange={(category) => onChange({ category })} />
        <ChoiceField id="ev-location" label="Location" value={form.location} options={keep(locations, form.location)} allowNone="No location" onChange={(location) => onChange({ location })} />
        <TextField id="ev-tags" label="Tags (comma separated)" value={form.tags} onChange={(tags) => onChange({ tags })} />
        <div className="flex items-center gap-2 pt-6">
          <Checkbox id="ev-verified" checked={form.verified} onCheckedChange={(value) => onChange({ verified: value === true })} />
          <Label htmlFor="ev-verified">Verified</Label>
        </div>
      </div>
    </Section>
  );
}

/** The collection task behind the evidence (who has to bring what by when). */
export function EvidenceTaskFields({ form, onChange }: EvidenceFieldsProps) {
  return (
    <Section title="Collection task" headingLevel={3}>
      <div className="grid gap-4 md:grid-cols-2">
        <AreaField id="ev-task" label="Task" value={form.task} maxLength={2000} onChange={(task) => onChange({ task })} />
        <DateInput id="ev-task-due" label="Due date" value={form.taskDueDate} onChange={(taskDueDate) => onChange({ taskDueDate })} />
        <ChoiceField
          id="ev-task-status"
          label="Task status"
          value={form.taskStatus}
          options={[
            { value: 'pending', label: 'Pending' },
            { value: 'completed', label: 'Completed' },
          ]}
          onChange={(value) => onChange({ taskStatus: value === 'completed' ? 'completed' : 'pending' })}
        />
      </div>
    </Section>
  );
}
