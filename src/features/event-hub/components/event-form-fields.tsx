import type { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DateTimeInput } from '@/features/ux-kit/date-inputs';
import { labelOf, PHYSICAL_TYPE_LABELS, SCHEDULE_CLASS_LABELS } from '@/features/ux-kit/labels';
import { useCalendarPreference } from '@/lib/dates';
import { PHYSICAL_TYPES, SCHEDULE_CLASSES } from '../model/event-filters';
import type { EventFormField, EventFormValues } from '../model/event-form';
import { plantLocalToUtc, utcToPlantLocal } from '../model/plant-local-time';
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

function FieldMessages({ id, error, hint }: { id: string; error?: string; hint?: string }) {
  return (
    <>
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive" data-testid={`error-${id}`}>
          {error}
        </p>
      )}
    </>
  );
}

function Field({ id, label, error, hint, children }: FieldProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
      <FieldMessages id={id} error={error} hint={hint} />
    </div>
  );
}

const SELECT_CLASS = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm';

interface PlantTimeFieldProps {
  field: 'startLocal' | 'endLocal';
  label: string;
  form: EventFormState;
}

/** A plant-clock date and time (tenant calendar); the form keeps the wall-clock text it always had. */
function PlantTimeField({ field, label, form }: PlantTimeFieldProps) {
  const env = useEventHubEnv();
  const preference = useCalendarPreference();
  const value = plantLocalToUtc(form.values[field], env.timezone);
  return (
    <div className="space-y-1" data-testid={`field-${field}`}>
      <DateTimeInput
        label={label}
        value={value}
        timeZone={env.timezone}
        calendar={preference.calendar}
        onChange={(iso) => form.setField(field, utcToPlantLocal(iso, env.timezone) as EventFormValues[typeof field])}
      />
      <FieldMessages id={field} error={form.errors[field]} hint={`Plant time (${env.timezone})`} />
    </div>
  );
}

/** Inputs of the event form; times are on the plant clock (shown in the hint), duration in minutes. */
export function EventFormFields({ form, mode }: { form: EventFormState; mode: 'create' | 'edit' }) {
  const env = useEventHubEnv();
  const { values, errors, setField } = form;
  const aria = (field: EventFormField) => ({ 'aria-invalid': Boolean(errors[field]), 'aria-describedby': errors[field] ? `${field}-error` : undefined });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
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
          {PHYSICAL_TYPES.map((type) => <option key={type} value={type}>{labelOf(PHYSICAL_TYPE_LABELS, type)}</option>)}
        </select>
      </Field>
      <PlantTimeField field="startLocal" label="Start" form={form} />
      <PlantTimeField field="endLocal" label="End (empty = still running)" form={form} />
      <Field id="durationMinutes" label="or duration (minutes)" error={errors.durationMinutes} hint="Sets the end from the start; must agree with an end you enter">
        <Input id="durationMinutes" inputMode="decimal" value={values.durationMinutes} onChange={(e) => setField('durationMinutes', e.target.value)} {...aria('durationMinutes')} />
      </Field>
      <Field id="scheduleClass" label="Schedule class" error={errors.scheduleClass} hint="Empty = the reason code's default">
        <select id="scheduleClass" className={SELECT_CLASS} value={values.scheduleClass} onChange={(e) => setField('scheduleClass', e.target.value)} {...aria('scheduleClass')}>
          <option value="">— default —</option>
          {SCHEDULE_CLASSES.map((value) => <option key={value} value={value}>{labelOf(SCHEDULE_CLASS_LABELS, value)}</option>)}
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
