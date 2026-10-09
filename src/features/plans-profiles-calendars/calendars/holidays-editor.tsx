import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HOLIDAY_TREATMENTS, type Holiday, type HolidayTreatment } from '@/api/v2/types/calendars';
import { NativeSelect } from '../components/native-select';
import type { FieldErrors } from '../model/profile-form';

export interface HolidaysEditorProps {
  rows: Holiday[];
  errors: FieldErrors;
  readOnly: boolean;
  onChange: (rows: Holiday[]) => void;
}

const TREATMENTS = HOLIDAY_TREATMENTS.map((value) => ({ value, label: value }));

/**
 * Holidays per operational date. `excluded` takes the day out of scheduled time (D03); `reduced` is stored
 * and only warned about in the preview — no reduction rule is decided yet, so the screen says so.
 */
export function HolidaysEditor({ rows, errors, readOnly, onChange }: HolidaysEditorProps) {
  const update = (index: number, patch: Partial<Holiday>) => onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  return (
    <fieldset className="space-y-2" data-testid="holidays">
      <legend className="text-sm font-medium">Holidays</legend>
      {rows.some((row) => row.treatment === 'reduced') && (
        <p className="text-xs text-amber-700" data-testid="reduced-undecided">
          “Reduced” holidays keep their shifts: the reduction rule is not decided yet (operations), the preview only warns.
        </p>
      )}
      {rows.map((row, index) => (
        <div key={index} className="space-y-1">
          <div className="grid grid-cols-[10rem_minmax(0,1fr)_9rem_auto] gap-2">
            <Input type="date" aria-label={`Date of holiday ${index + 1}`} value={row.date} disabled={readOnly} onChange={(e) => update(index, { date: e.target.value })} />
            <Input aria-label={`Name of holiday ${index + 1}`} value={row.name} disabled={readOnly} onChange={(e) => update(index, { name: e.target.value })} />
            <NativeSelect id={`holiday-${index}-treatment`} value={row.treatment} options={TREATMENTS} disabled={readOnly} onChange={(v) => update(index, { treatment: v as HolidayTreatment })} />
            {!readOnly && (
              <Button type="button" size="sm" variant="ghost" onClick={() => onChange(rows.filter((_, i) => i !== index))}>
                Remove
              </Button>
            )}
          </div>
          {[errors[`holidays.${index}.date`], errors[`holidays.${index}.name`]].filter(Boolean).map((message) => (
            <p key={message} className="text-xs text-destructive">
              {message}
            </p>
          ))}
        </div>
      ))}
      {!readOnly && (
        <Button type="button" size="sm" variant="outline" onClick={() => onChange([...rows, { date: '', name: '', treatment: 'excluded' }])}>
          Add holiday
        </Button>
      )}
    </fieldset>
  );
}
