import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { EventFormField, EventFormValues, FieldErrors } from '../model/event-form';

const SELECT_CLASS = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm';

const SEVERITIES: ReadonlyArray<[string, string]> = [
  ['', 'Pending investigation'],
  ['critical', 'Critical — function lost (counts in MTBF)'],
  ['degraded', 'Degraded — function partly lost (counts in MTBF)'],
  ['incipient', 'Incipient — no loss of function yet (not a failure)'],
];

const TEXT_FIELDS: ReadonlyArray<[EventFormField, string, string]> = [
  ['failureMode', 'Failure mode', 'e.g. external leakage'],
  ['maintainableItem', 'Maintainable item', 'e.g. mechanical seal'],
  ['failureMechanism', 'Mechanism', 'e.g. wear'],
  ['failureCause', 'Cause', 'e.g. inadequate flush'],
  ['detectionMethod', 'Detection method', 'e.g. inspection'],
];

interface FailureForm {
  values: EventFormValues;
  errors: FieldErrors;
  setField: (field: EventFormField, value: string) => void;
}

/**
 * SME D8 / D11: the technical failure description of a stop (ISO 14224-aligned). Severity decides whether
 * it is a functional failure for MTBF; every field may stay empty until the investigation knows it.
 * Downtime only; operations reasons stay in the reason code.
 */
export function FailureFields({ form }: { form: FailureForm }) {
  const { values, errors, setField } = form;
  if (values.physicalType !== 'downtime') return null;
  return (
    <fieldset className="space-y-3 rounded-md border p-3 sm:col-span-2" data-testid="failure-fields">
      <legend className="px-1 text-sm font-medium">Failure detail (maintenance)</legend>
      <div className="space-y-1">
        <Label htmlFor="failureSeverity">Severity</Label>
        <select id="failureSeverity" className={SELECT_CLASS} value={values.failureSeverity} onChange={(e) => setField('failureSeverity', e.target.value)}>
          {SEVERITIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {TEXT_FIELDS.map(([field, label, placeholder]) => (
          <div key={field} className="space-y-1">
            <Label htmlFor={field}>{label}</Label>
            <Input id={field} value={values[field]} placeholder={placeholder} maxLength={field === 'failureMode' ? 255 : 100}
              onChange={(e) => setField(field, e.target.value)} aria-invalid={Boolean(errors[field])} />
            {errors[field] && <p className="text-xs text-destructive">{errors[field]}</p>}
          </div>
        ))}
      </div>
    </fieldset>
  );
}
