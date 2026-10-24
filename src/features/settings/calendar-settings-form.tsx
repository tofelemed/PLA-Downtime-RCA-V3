import { useEffect, useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { formatDateTime, isCalendarSystem, isDigitSystem, type CalendarPreference } from '@/lib/dates';
import { useSaveDisplaySettings } from './use-tenant-display-settings';
import { READ_ONLY_REASON } from './week-start-choices';

interface Choice<T extends string> {
  value: T;
  label: string;
  hint: string;
}

const CALENDARS: ReadonlyArray<Choice<CalendarPreference['calendar']>> = [
  { value: 'gregorian', label: 'Gregorian', hint: 'e.g. 2026-10-12' },
  { value: 'persian', label: 'Persian (Jalali / Shamsi)', hint: 'e.g. 1405/07/20' },
];
const DIGITS: ReadonlyArray<Choice<CalendarPreference['digits']>> = [
  { value: 'latin', label: 'Latin digits', hint: '0123456789' },
  { value: 'persian', label: 'Persian digits', hint: '۰۱۲۳۴۵۶۷۸۹' },
];

function ChoiceGroup<T extends string>(props: { name: string; legend: string; choices: ReadonlyArray<Choice<T>>; value: T; onChange: (value: string) => void }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{props.legend}</legend>
      <RadioGroup value={props.value} onValueChange={props.onChange} aria-label={props.legend}>
        {props.choices.map((choice) => (
          <div key={choice.value} className="flex items-center gap-2">
            <RadioGroupItem id={`${props.name}-${choice.value}`} value={choice.value} />
            <Label htmlFor={`${props.name}-${choice.value}`} className="font-normal">
              {choice.label} <span className="text-muted-foreground">({choice.hint})</span>
            </Label>
          </div>
        ))}
      </RadioGroup>
    </fieldset>
  );
}

function Preview({ timeZone, value }: { timeZone: string; value: CalendarPreference }) {
  const preview = formatDateTime(new Date().toISOString(), { timeZone, ...value, withZone: false });
  return (
    <p className="text-sm">
      <span className="text-muted-foreground">Preview: </span>
      <span data-testid="calendar-preview">{preview}</span>
    </p>
  );
}

/** The saved setting as text, for users who may not change it. */
function ReadOnlyDisplay({ saved, timeZone }: { saved: CalendarPreference; timeZone: string }) {
  const label = <T extends string>(choices: ReadonlyArray<Choice<T>>, value: T) => choices.find((c) => c.value === value)?.label ?? value;
  return (
    <div className="space-y-2 text-sm" data-testid="calendar-settings-read-only">
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[10rem_1fr]">
        <dt className="text-muted-foreground">Calendar system</dt>
        <dd>{label(CALENDARS, saved.calendar)}</dd>
        <dt className="text-muted-foreground">Digits</dt>
        <dd>{label(DIGITS, saved.digits)}</dd>
      </dl>
      <Preview timeZone={timeZone} value={saved} />
      <p className="text-muted-foreground">{READ_ONLY_REASON}</p>
    </div>
  );
}

export interface CalendarSettingsFormProps {
  saved: CalendarPreference;
  timeZone: string;
  canEdit: boolean;
}

/** Calendar system and digits of the plant, with a live preview; saving needs `canManagePlantSettings`. */
export function CalendarSettingsForm({ saved, timeZone, canEdit }: CalendarSettingsFormProps) {
  const [draft, setDraft] = useState<CalendarPreference>(saved);
  useEffect(() => setDraft(saved), [saved]);
  const save = useSaveDisplaySettings();
  if (!canEdit) return <ReadOnlyDisplay saved={saved} timeZone={timeZone} />;
  const dirty = draft.calendar !== saved.calendar || draft.digits !== saved.digits;
  const submit = () =>
    save.mutate(draft, { onSuccess: () => toast({ title: 'Plant settings saved', description: 'Dates now show in the chosen calendar.' }) });
  return (
    <div className="space-y-5">
      <ChoiceGroup name="calendar" legend="Calendar system" choices={CALENDARS} value={draft.calendar}
        onChange={(value) => isCalendarSystem(value) && setDraft((d) => ({ ...d, calendar: value }))} />
      <ChoiceGroup name="digits" legend="Digits" choices={DIGITS} value={draft.digits}
        onChange={(value) => isDigitSystem(value) && setDraft((d) => ({ ...d, digits: value }))} />
      <Preview timeZone={timeZone} value={draft} />
      {save.isError && <FriendlyErrorAlert error={save.error} />}
      <div className="flex gap-2">
        <Button variant="outline" className="h-9" onClick={() => setDraft(saved)} disabled={!dirty || save.isPending}>Discard changes</Button>
        <Button className="h-9" onClick={submit} disabled={!dirty || save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</Button>
      </div>
    </div>
  );
}
