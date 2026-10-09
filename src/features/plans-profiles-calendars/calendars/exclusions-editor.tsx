import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EXCLUSION_KINDS, type ExclusionKind } from '@/api/v2/types/calendars';
import { NativeSelect } from '../components/native-select';
import type { ExclusionRow } from '../model/calendar-draft';
import type { FieldErrors } from '../model/profile-form';

export interface ExclusionsEditorProps {
  rows: ExclusionRow[];
  timezone: string;
  errors: FieldErrors;
  readOnly: boolean;
  onChange: (rows: ExclusionRow[]) => void;
}

const KINDS = EXCLUSION_KINDS.map((value) => ({ value, label: value.replace('_', ' ') }));

/** Exceptional exclusions (planned shutdown, turnaround, no demand) typed on the calendar's clock, half-open. */
export function ExclusionsEditor({ rows, timezone, errors, readOnly, onChange }: ExclusionsEditorProps) {
  const update = (index: number, patch: Partial<ExclusionRow>) => onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  return (
    <fieldset className="space-y-2" data-testid="exclusions">
      <legend className="text-sm font-medium">Schedule exclusions ({timezone || 'calendar zone'})</legend>
      {rows.map((row, index) => (
        <div key={index} className="space-y-1">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_10rem_auto] gap-2">
            <Input type="datetime-local" aria-label={`Start of exclusion ${index + 1}`} value={row.from} disabled={readOnly} onChange={(e) => update(index, { from: e.target.value })} />
            <Input type="datetime-local" aria-label={`End of exclusion ${index + 1}`} value={row.to} disabled={readOnly} onChange={(e) => update(index, { to: e.target.value })} />
            <Input aria-label={`Reason of exclusion ${index + 1}`} value={row.reason} disabled={readOnly} onChange={(e) => update(index, { reason: e.target.value })} />
            <NativeSelect id={`exclusion-${index}-kind`} value={row.kind} options={KINDS} disabled={readOnly} onChange={(v) => update(index, { kind: v as ExclusionKind })} />
            {!readOnly && (
              <Button type="button" size="sm" variant="ghost" onClick={() => onChange(rows.filter((_, i) => i !== index))}>
                Remove
              </Button>
            )}
          </div>
          {['from', 'to', 'reason'].map((field) => errors[`exclusions.${index}.${field}`]).filter(Boolean).map((message) => (
            <p key={message} className="text-xs text-destructive">
              {message}
            </p>
          ))}
        </div>
      ))}
      {!readOnly && (
        <Button type="button" size="sm" variant="outline" onClick={() => onChange([...rows, { from: '', to: '', reason: '', kind: 'planned_shutdown' }])}>
          Add exclusion
        </Button>
      )}
    </fieldset>
  );
}
