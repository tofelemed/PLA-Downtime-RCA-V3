import { FormField } from '@/features/ux-kit/form-field';
import { labelOf, OEE_COMPONENT_LABELS } from '@/features/ux-kit/labels';
import type { EventFormField, EventFormValues, FieldErrors } from '../model/event-form';
import { OEE_COMPONENTS } from '../model/event-filters';

const SELECT_CLASS = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm';

interface OeeComponentForm {
  values: EventFormValues;
  errors: FieldErrors;
  setField: (field: EventFormField, value: string) => void;
}

/**
 * The OEE component the stop counts in (Marun E2E 1.5): stored value shown, empty = the reason code's
 * default; a choice is sent as `oeeComponent` (create / PATCH DTO).
 */
export function OeeComponentField({ form }: { form: OeeComponentForm }) {
  const { values, errors, setField } = form;
  return (
    <FormField id="oeeComponent" label="OEE component" error={errors.oeeComponent} errorTestId="error-oeeComponent" hint="Empty = the reason code's default">
      <select id="oeeComponent" className={SELECT_CLASS} value={values.oeeComponent} onChange={(e) => setField('oeeComponent', e.target.value)}>
        <option value="">— default —</option>
        {OEE_COMPONENTS.map((value) => <option key={value} value={value}>{labelOf(OEE_COMPONENT_LABELS, value)}</option>)}
      </select>
    </FormField>
  );
}
