import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { DateInput } from '@/features/ux-kit/date-inputs';
import { ConsequenceSelect, PrioritySelect } from '../../cases/status-fields';
import { UnitSelect } from '../../cases/unit-select';
import type { RcaCaseForm } from '../../model/rca-form';
import { CHARTER_INFO, ROOT_CAUSE_INFO } from '../definition/definition-info';
import { DefinitionReadView } from '../definition/definition-read-view';

export interface DefinitionFieldsProps {
  form: RcaCaseForm;
  onChange: (patch: Partial<RcaCaseForm>) => void;
  /** values as text (closed investigation, a reader, or a draft not restored yet) */
  readOnly: boolean;
  /** inputs kept but disabled (a save is running) */
  disabled?: boolean;
}

interface TextAreaProps {
  id: string;
  label: string;
  value: string;
  info?: string;
  onChange: (value: string) => void;
}

function TextArea({ id, label, value, info, onChange }: TextAreaProps) {
  return (
    <div className="space-y-1.5 md:col-span-2">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id}>{label}</Label>
        {info && <KpiInfo label={label} text={info} />}
      </div>
      <Textarea id={id} rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/** Title, consequence class, priority, target date, unit, problem, team charter and root cause of the case. */
export function DefinitionFields({ form, onChange, readOnly, disabled = false }: DefinitionFieldsProps) {
  if (readOnly) return <DefinitionReadView form={form} />;
  return (
    <fieldset disabled={disabled} className="grid min-w-0 gap-4 md:grid-cols-2" data-testid="case-editor" data-mode="edit">
      <div className="space-y-1.5 md:col-span-2">
        <Label htmlFor="edit-title">Title</Label>
        <Input id="edit-title" value={form.title} maxLength={255} onChange={(e) => onChange({ title: e.target.value })} />
      </div>
      <ConsequenceSelect id="edit-consequence" value={form.consequenceClass} onChange={(consequenceClass) => onChange({ consequenceClass })} />
      <PrioritySelect id="edit-priority" value={form.priority} onChange={(priority) => onChange({ priority })} />
      <DateInput id="edit-target" label="Target close date" value={form.targetCloseDate} disabled={disabled} onChange={(targetCloseDate) => onChange({ targetCloseDate })} />
      <UnitSelect id="edit-unit" value={form.unitId} onChange={(unitId) => onChange({ unitId })} />
      <TextArea id="edit-description" label="Problem statement" value={form.description} onChange={(description) => onChange({ description })} />
      <TextArea id="edit-charter" label="Team charter" value={form.teamCharter} info={CHARTER_INFO} onChange={(teamCharter) => onChange({ teamCharter })} />
      <TextArea id="edit-root-cause" label="Root cause" value={form.rootCause} info={ROOT_CAUSE_INFO} onChange={(rootCause) => onChange({ rootCause })} />
    </fieldset>
  );
}
