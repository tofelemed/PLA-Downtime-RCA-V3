import { Label } from '@/components/ui/label';
import { DecimalInput } from '@/features/ux-kit/decimal-input';
import { DECLARED_STATUSES, declaredIdentityHint, type DeclaredField } from '../model/declared-form';
import type { EventFormValues, FieldErrors } from '../model/event-form';

const SELECT_CLASS = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm';

interface DeclaredForm {
  values: EventFormValues;
  errors: FieldErrors;
  setField: (field: DeclaredField, value: string) => void;
}

function TonnesField({ form, field, label, required = false }: { form: DeclaredForm; field: DeclaredField; label: string; required?: boolean }) {
  const error = form.errors[field];
  return (
    <div className="space-y-1">
      <Label htmlFor={field}>{label}{required ? ' *' : ''}</Label>
      <DecimalInput id={field} value={form.values[field] || null} onChange={(value) => form.setField(field, value ?? '')} allowNegative />
      {error && <p className="text-xs text-destructive" data-testid={`error-${field}`}>{error}</p>}
    </div>
  );
}

/**
 * Declared mode, manual "Production loss" (D7): the day's planned and actual output and the shortfall in
 * tonnes, and the OT status. The identity planned − actual = shortfall is only hinted here; the server
 * flags a mismatch for review. The end time is required (see the interval fields).
 */
export function DeclaredFields({ form }: { form: DeclaredForm }) {
  const hint = declaredIdentityHint(form.values);
  return (
    <fieldset className="grid gap-3 rounded-md border p-3 sm:col-span-2 sm:grid-cols-4" data-testid="declared-fields">
      <legend className="px-1 text-sm font-medium">Production loss (tonnes)</legend>
      <TonnesField form={form} field="declaredPlanned" label="Planned (t)" />
      <TonnesField form={form} field="declaredActual" label="Actual (t)" />
      <TonnesField form={form} field="declaredShortfall" label="Shortfall (t)" required />
      <div className="space-y-1">
        <Label htmlFor="declaredStatus">OT status</Label>
        <select id="declaredStatus" className={SELECT_CLASS} value={form.values.declaredStatus} onChange={(e) => form.setField('declaredStatus', e.target.value)}>
          <option value="">— not stated —</option>
          {DECLARED_STATUSES.map((status) => <option key={status} value={status}>{status === 'DETECTED' ? 'Detected' : 'Confirmed'}</option>)}
        </select>
      </div>
      {hint && <p className="text-xs text-warning sm:col-span-4" data-testid="declared-identity-hint">{hint}</p>}
    </fieldset>
  );
}
