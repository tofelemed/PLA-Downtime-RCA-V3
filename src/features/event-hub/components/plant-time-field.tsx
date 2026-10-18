import { Button } from '@/components/ui/button';
import { DateTimeInput } from '@/features/ux-kit/date-inputs';
import { fieldErrorId, fieldHintId } from '@/features/ux-kit/form-field-ids';
import { useCalendarPreference } from '@/lib/dates';
import type { EventFormValues } from '../model/event-form';
import { plantLocalToUtc, utcToPlantLocal } from '../model/plant-local-time';
import type { EventFormState } from '../hooks/use-event-form';
import { useEventHubEnv } from '../use-event-hub-env';

function TimeMessages({ id, error, hint }: { id: string; error?: string; hint: string }) {
  if (error) {
    return <p id={fieldErrorId(id)} role="alert" className="text-xs text-destructive" data-testid={`error-${id}`}>{error}</p>;
  }
  return <p id={fieldHintId(id)} className="text-xs text-muted-foreground">{hint}</p>;
}

export interface PlantTimeFieldProps {
  field: 'startLocal' | 'endLocal' | 'plannedEndLocal';
  label: string;
  form: Pick<EventFormState, 'values' | 'errors' | 'setField'>;
  /** E-L7: a "Now" button fills the current plant time on click (never a silent default) */
  withNow?: boolean;
  required?: boolean;
}

/** A plant-clock date and time (tenant calendar); the form keeps the wall-clock text it always had. */
export function PlantTimeField({ field, label, form, withNow = false, required = false }: PlantTimeFieldProps) {
  const env = useEventHubEnv();
  const preference = useCalendarPreference();
  const value = plantLocalToUtc(form.values[field], env.timezone);
  const set = (iso: string | null) => form.setField(field, utcToPlantLocal(iso, env.timezone) as EventFormValues[typeof field]);
  return (
    <div className="space-y-1" data-testid={`field-${field}`}>
      <DateTimeInput label={label} required={required} value={value} timeZone={env.timezone} calendar={preference.calendar} onChange={set} />
      {withNow && (
        <Button type="button" size="sm" variant="outline" data-testid={`now-${field}`} onClick={() => set(new Date().toISOString())}>
          Now
        </Button>
      )}
      <TimeMessages id={field} error={form.errors[field]} hint={`Plant time (${env.timezone})`} />
    </div>
  );
}
