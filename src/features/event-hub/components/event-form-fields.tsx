import type { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PHYSICAL_TYPES, SCHEDULE_CLASSES } from '../model/event-filters';
import type { EventFormField } from '../model/event-form';
import { humanize } from '../model/event-states';
import type { EventFormState } from '../hooks/use-event-form';
import { useEventHubEnv } from '../use-event-hub-env';
import { ReasonCodeSelect } from './reason-code-select';

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

function Field({ id, label, error, hint, children }: FieldProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive" data-testid={`error-${id}`}>
          {error}
        </p>
      )}
    </div>
  );
}

const SELECT_CLASS = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm';

/** Inputs of the event form; times are on the plant clock (shown in the hint), duration in minutes. */
export function EventFormFields({ form, mode }: { form: EventFormState; mode: 'create' | 'edit' }) {
  const env = useEventHubEnv();
  const { values, errors, setField } = form;
  const aria = (field: EventFormField) => ({ 'aria-invalid': Boolean(errors[field]), 'aria-describedby': errors[field] ? `${field}-error` : undefined });
  const zoneHint = `Plant time (${env.timezone})`;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {mode === 'create' && (
        <Field id="unitId" label="Unit" error={errors.unitId}>
          <select id="unitId" className={SELECT_CLASS} value={values.unitId} onChange={(e) => setField('unitId', e.target.value)} {...aria('unitId')}>
            <option value="">— choose —</option>
            {env.units.map((unit) => (
              <option key={unit.id} value={unit.id}>{unit.name}</option>
            ))}
          </select>
        </Field>
      )}
      <Field id="physicalType" label="Type" error={errors.physicalType}>
        <select id="physicalType" className={SELECT_CLASS} value={values.physicalType} onChange={(e) => setField('physicalType', e.target.value)} {...aria('physicalType')}>
          {PHYSICAL_TYPES.map((type) => <option key={type} value={type}>{humanize(type)}</option>)}
        </select>
      </Field>
      <Field id="startLocal" label="Start" error={errors.startLocal} hint={zoneHint}>
        <Input id="startLocal" type="datetime-local" value={values.startLocal} onChange={(e) => setField('startLocal', e.target.value)} {...aria('startLocal')} />
      </Field>
      <Field id="endLocal" label="End (empty = still running)" error={errors.endLocal} hint={zoneHint}>
        <Input id="endLocal" type="datetime-local" value={values.endLocal} onChange={(e) => setField('endLocal', e.target.value)} {...aria('endLocal')} />
      </Field>
      <Field id="durationMinutes" label="or duration (minutes)" error={errors.durationMinutes} hint="Sets the end from the start; must agree with an end you enter">
        <Input id="durationMinutes" inputMode="decimal" value={values.durationMinutes} onChange={(e) => setField('durationMinutes', e.target.value)} {...aria('durationMinutes')} />
      </Field>
      <Field id="scheduleClass" label="Schedule class" error={errors.scheduleClass} hint="Empty = the reason code's default">
        <select id="scheduleClass" className={SELECT_CLASS} value={values.scheduleClass} onChange={(e) => setField('scheduleClass', e.target.value)} {...aria('scheduleClass')}>
          <option value="">— default —</option>
          {SCHEDULE_CLASSES.map((value) => <option key={value} value={value}>{humanize(value)}</option>)}
        </select>
      </Field>
      <div className="sm:col-span-2">
        <ReasonCodeSelect id="reasonCodeId" value={values.reasonCodeId} onChange={(value) => setField('reasonCodeId', value)} error={errors.reasonCodeId} />
      </div>
      <div className="sm:col-span-2">
        <Field id="description" label="Description" error={errors.description}>
          <Textarea id="description" value={values.description} maxLength={4000} onChange={(e) => setField('description', e.target.value)} {...aria('description')} />
        </Field>
      </div>
    </div>
  );
}
