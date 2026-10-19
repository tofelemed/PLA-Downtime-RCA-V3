import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DateInput } from '@/features/ux-kit/date-inputs';
import { FormField } from '@/features/ux-kit/form-field';
import { PrioritySelect } from '../cases/status-fields';
import { UnitSelect } from '../cases/unit-select';
import type { RcaCaseForm } from '../model/rca-form';
import { TemplateSelect } from './template-select';

export interface NewCaseFieldsProps {
  form: RcaCaseForm;
  onChange: (patch: Partial<RcaCaseForm>) => void;
  /** the unit is fixed by the event being investigated */
  unitLocked?: boolean;
}

/** Fields of a new case: title (required, marked), problem, priority, target date, unit and template. */
export function NewCaseFields({ form, onChange, unitLocked = false }: NewCaseFieldsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2" data-testid="new-case-fields">
      <FormField id="case-title" label="Title" required className="md:col-span-2">
        <Input
          id="case-title"
          value={form.title}
          maxLength={255}
          required
          placeholder="Brief description of the issue"
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </FormField>
      <div className="space-y-1 md:col-span-2">
        <Label htmlFor="case-description">Problem statement</Label>
        <Textarea
          id="case-description"
          value={form.description}
          placeholder="What happened, where and when"
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </div>
      <PrioritySelect id="case-priority" value={form.priority} onChange={(priority) => onChange({ priority })} />
      <DateInput id="case-target" label="Target close date" value={form.targetCloseDate} onChange={(targetCloseDate) => onChange({ targetCloseDate })} />
      {unitLocked ? null : <UnitSelect id="case-unit" value={form.unitId} onChange={(unitId) => onChange({ unitId })} />}
      <TemplateSelect value={form.templateId} onChange={(templateId) => onChange({ templateId })} />
    </div>
  );
}
