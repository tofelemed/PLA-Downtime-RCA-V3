import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DateInput } from '@/features/ux-kit/date-inputs';
import { PrioritySelect, StatusSelect } from '../../cases/status-fields';
import { UnitSelect } from '../../cases/unit-select';
import type { RcaCaseForm } from '../../model/rca-form';

export interface DefinitionFieldsProps {
  form: RcaCaseForm;
  onChange: (patch: Partial<RcaCaseForm>) => void;
  readOnly: boolean;
}

function TextArea({ id, label, value, hint, onChange }: { id: string; label: string; value: string; hint?: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1 md:col-span-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-describedby={hint ? `${id}-hint` : undefined} />
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

/** Title, status, priority, target date, unit, problem, team charter and root cause of the case. */
export function DefinitionFields({ form, onChange, readOnly }: DefinitionFieldsProps) {
  return (
    <fieldset disabled={readOnly} className="grid gap-4 md:grid-cols-2" data-testid="case-editor">
      <div className="space-y-1 md:col-span-2">
        <Label htmlFor="edit-title">Title</Label>
        <Input id="edit-title" value={form.title} maxLength={255} onChange={(e) => onChange({ title: e.target.value })} />
      </div>
      <StatusSelect id="edit-status" value={form.status} onChange={(status) => onChange({ status })} />
      <PrioritySelect id="edit-priority" value={form.priority} onChange={(priority) => onChange({ priority })} />
      <DateInput id="edit-target" label="Target close date" value={form.targetCloseDate} disabled={readOnly} onChange={(targetCloseDate) => onChange({ targetCloseDate })} />
      <UnitSelect id="edit-unit" value={form.unitId} onChange={(unitId) => onChange({ unitId })} />
      <TextArea id="edit-description" label="Problem statement" value={form.description} onChange={(description) => onChange({ description })} />
      <TextArea
        id="edit-charter"
        label="Team charter"
        value={form.teamCharter}
        hint="Mission, scope and goals of the investigation, e.g. why pump P-101 keeps tripping and what will stop it."
        onChange={(teamCharter) => onChange({ teamCharter })}
      />
      <TextArea
        id="edit-root-cause"
        label="Root cause"
        value={form.rootCause}
        hint="A person's finding; automation never sets it. The 5-Why tool can fill it in."
        onChange={(rootCause) => onChange({ rootCause })}
      />
    </fieldset>
  );
}
