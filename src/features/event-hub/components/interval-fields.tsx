import type { ProductionEventView } from '@/api/v2/types/events';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { DurationText } from '@/features/ux-kit/duration-text';
import { FormField } from '@/features/ux-kit/form-field';
import { usePlantFormat } from '../hooks/use-plant-format';
import { DURATION_INPUT_HINT } from '../model/duration-input';
import type { IntervalMode } from '../model/event-form';
import type { EventFormState } from '../hooks/use-event-form';
import { PlantTimeField } from './plant-time-field';

export interface IntervalFieldsProps {
  form: Pick<EventFormState, 'values' | 'errors' | 'setField'>;
  mode: 'create' | 'edit';
  /** edit: the stored event, whose server-computed duration is shown read-only */
  event?: ProductionEventView | null;
  /** E-5: the source that owns the interval (start, end, duration read only); null = editable */
  sourceName?: string | null;
}

/** E-4: what the server holds now, read only, next to start and end. */
function ServerDuration({ event }: { event: ProductionEventView }) {
  return (
    <p className="text-sm sm:col-span-2" data-testid="server-duration">
      <span className="text-muted-foreground">Current duration (server): </span>
      {event.isOpen ? (
        <>
          Ongoing <DurationText seconds={event.elapsedSeconds} />
        </>
      ) : (
        <DurationText seconds={event.durationSeconds} />
      )}
    </p>
  );
}

/**
 * E-5: the interval of a source event — the server refuses changes to start, end and duration (409
 * SOURCE_OWNED), so they are shown, not offered as inputs, with the reason.
 */
function SourceInterval({ event, sourceName }: { event: ProductionEventView; sourceName: string }) {
  const { dateTime } = usePlantFormat();
  return (
    <div className="space-y-1 rounded-md border p-3 text-sm sm:col-span-2" data-testid="source-interval">
      <dl className="grid grid-cols-[7rem_1fr] gap-x-4 gap-y-1">
        <dt className="text-muted-foreground">Start</dt>
        <dd data-testid="source-interval-start">{dateTime(event.startTime)}</dd>
        <dt className="text-muted-foreground">End</dt>
        <dd>{event.endTime ? dateTime(event.endTime) : 'Ongoing'}</dd>
      </dl>
      <p className="text-xs text-muted-foreground">
        From {sourceName}: start, end and duration belong to the source and cannot be changed here. Correct them in the source system.
      </p>
    </div>
  );
}

function IntervalModeChoice({ value, onChange }: { value: IntervalMode; onChange: (next: IntervalMode) => void }) {
  return (
    <fieldset className="space-y-2" data-testid="interval-mode">
      <legend className="text-sm font-medium leading-none">End given as</legend>
      <RadioGroup value={value} onValueChange={(next) => onChange(next === 'duration' ? 'duration' : 'end')} className="flex gap-4">
        <div className="flex items-center gap-2">
          <RadioGroupItem id="interval-end" value="end" data-testid="interval-mode-end" />
          <Label htmlFor="interval-end" className="font-normal">End time</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem id="interval-duration" value="duration" data-testid="interval-mode-duration" />
          <Label htmlFor="interval-duration" className="font-normal">Duration</Label>
        </div>
      </RadioGroup>
    </fieldset>
  );
}

/**
 * Start, and the end given **either** as an end time **or** as a duration from the start (E-4): an
 * explicit choice, so typing a duration never clears an end behind the user's back. Durations read
 * "2h 30m", "2:30" or minutes; the server derives and stores the duration.
 */
export function IntervalFields({ form, mode, event, sourceName = null }: IntervalFieldsProps) {
  const { values, errors, setField } = form;
  if (mode === 'edit' && event && sourceName) {
    return (
      <>
        <SourceInterval event={event} sourceName={sourceName} />
        <ServerDuration event={event} />
      </>
    );
  }
  return (
    <>
      <PlantTimeField field="startLocal" label="Start" form={form} withNow={mode === 'create'} required />
      <IntervalModeChoice value={values.intervalMode} onChange={(next) => setField('intervalMode', next)} />
      {values.intervalMode === 'duration' ? (
        <FormField
          id="durationMinutes"
          label="Duration"
          error={errors.durationMinutes}
          errorTestId="error-durationMinutes"
          required
          hint={`${DURATION_INPUT_HINT}. The end is set from the start plus this duration.`}
        >
          <Input id="durationMinutes" value={values.durationMinutes} onChange={(e) => setField('durationMinutes', e.target.value)} />
        </FormField>
      ) : (
        <PlantTimeField field="endLocal" label="End (empty = still ongoing)" form={form} />
      )}
      {mode === 'edit' && event && <ServerDuration event={event} />}
    </>
  );
}
