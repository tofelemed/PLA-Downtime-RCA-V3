import { useRcaEvidenceOptions } from '@/api/v2/queries/rca-cases';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { DateInput, DateTimeInput } from '@/features/ux-kit/date-inputs';
import { OwnerSelect } from '../../actions/owner-select';
import { useAssetOptions } from '../../use-asset-options';
import { EVIDENCE_TYPES, FIVE_P, SEVERITIES, type EvidenceForm } from '../../model/evidence-form';
import { useRcaFormat } from '../../use-rca-format';
import { AreaField, ChoiceField, FieldGroup, optionsOf, TextField, type ChoiceOption } from './form-controls';
import { EVIDENCE_REQUEST_LABELS as REQ } from '../../model/evidence-request-labels';

export interface EvidenceFieldsProps {
  form: EvidenceForm;
  onChange: (patch: Partial<EvidenceForm>) => void;
}

/** The title's validation message once the field was left with it empty. */
export const TITLE_REQUIRED = 'Enter a title.';

export interface EvidenceDetailsFieldsProps extends EvidenceFieldsProps {
  /** the title field was left once: an empty title shows its message */
  titleTouched?: boolean;
  onTitleBlur?: () => void;
}

/** Title, type, description, source and when / where it was observed. */
export function EvidenceDetailsFields({ form, onChange, titleTouched = false, onTitleBlur }: EvidenceDetailsFieldsProps) {
  const { timezone } = useRcaFormat();
  const assets = useAssetOptions();
  const titleError = titleTouched && form.title.trim() === '' ? TITLE_REQUIRED : null;
  return (
    <FieldGroup title="Details">
      <TextField id="ev-title" label="Title" value={form.title} maxLength={255} required error={titleError} onBlur={onTitleBlur} onChange={(title) => onChange({ title })} wide />
      <ChoiceField id="ev-type" label="Type" value={form.type} options={optionsOf(EVIDENCE_TYPES)} onChange={(type) => onChange({ type })} />
      <TextField id="ev-source" label="Source (tag, document, photo reference)" value={form.source} maxLength={500} onChange={(source) => onChange({ source })} />
      <AreaField id="ev-description" label="Description" value={form.description} maxLength={4000} onChange={(description) => onChange({ description })} />
      <DateTimeInput label="Observed at" value={form.occurredAt} timeZone={timezone} onChange={(occurredAt) => onChange({ occurredAt })} />
      <ChoiceField id="ev-asset" label="Related asset" value={form.assetId} options={assets} allowNone="No asset" onChange={(assetId) => onChange({ assetId })} />
    </FieldGroup>
  );
}

/** 5P, severity, category, location, tags and the verified flag. */
export function EvidenceClassificationFields({ form, onChange }: EvidenceFieldsProps) {
  const options = useRcaEvidenceOptions();
  const categories = optionsOf(options.data?.categories ?? []);
  const locations = optionsOf(options.data?.locations ?? []);
  const keep = (list: ChoiceOption[], value: string): ChoiceOption[] => (value && !list.some((o) => o.value === value) ? [...list, { value, label: value }] : list);
  return (
    <FieldGroup title="Classification">
      <ChoiceField id="ev-fivep" label="5P category" value={form.fiveP} options={optionsOf(FIVE_P)} onChange={(fiveP) => onChange({ fiveP })} />
      <ChoiceField id="ev-severity" label="Severity" value={form.severity} options={optionsOf(SEVERITIES)} onChange={(severity) => onChange({ severity })} />
      <ChoiceField id="ev-category" label="Category" value={form.category} options={keep(categories, form.category)} allowNone="No category" onChange={(category) => onChange({ category })} />
      <ChoiceField id="ev-location" label="Location" value={form.location} options={keep(locations, form.location)} allowNone="No location" onChange={(location) => onChange({ location })} />
      <TextField id="ev-tags" label="Tags (comma separated)" value={form.tags} onChange={(tags) => onChange({ tags })} />
      <div className="flex h-9 items-center gap-2 self-end">
        <Checkbox id="ev-verified" checked={form.verified} onCheckedChange={(value) => onChange({ verified: value === true })} />
        <Label htmlFor="ev-verified">Verified</Label>
      </div>
    </FieldGroup>
  );
}

/** The evidence request behind the item (who has to bring what by when; a plant member) — not a Task Management task. */
export function EvidenceTaskFields({ form, onChange }: EvidenceFieldsProps) {
  return (
    <FieldGroup title={REQ.section}>
      <AreaField id="ev-task" label={REQ.request} value={form.task} maxLength={2000} onChange={(task) => onChange({ task })} />
      <OwnerSelect id="ev-task-assignee" label={REQ.requestedFrom} noneLabel="Not assigned" value={form.taskAssigneeId} onChange={(taskAssigneeId) => onChange({ taskAssigneeId })} />
      <DateInput id="ev-task-due" label="Due date" compact value={form.taskDueDate} onChange={(taskDueDate) => onChange({ taskDueDate })} />
      <ChoiceField
        id="ev-task-status"
        label={REQ.status}
        value={form.taskStatus}
        options={[
          { value: 'pending', label: 'Pending' },
          { value: 'completed', label: 'Done' },
        ]}
        onChange={(value) => onChange({ taskStatus: value === 'completed' ? 'completed' : 'pending' })}
      />
    </FieldGroup>
  );
}
