import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EXCLUSION_KINDS, type ExclusionKind } from '@/api/v2/types/calendars';
import { EXCLUSION_KIND_LABELS } from '@/features/ux-kit/labels';
import { NativeSelect } from '../components/native-select';
import { PlantDateTimeField } from '../components/plant-date-time-field';
import type { ExclusionRow } from '../model/calendar-draft';
import type { FieldErrors } from '../model/profile-form';

export interface ExclusionsEditorProps {
  rows: ExclusionRow[];
  timezone: string;
  errors: FieldErrors;
  readOnly: boolean;
  onChange: (rows: ExclusionRow[]) => void;
}

const KINDS = EXCLUSION_KINDS.map((value) => ({ value, label: EXCLUSION_KIND_LABELS[value] }));

/** Exceptional exclusions (planned shutdown, turnaround, no demand) typed on the calendar's clock, half-open. */
export function ExclusionsEditor({ rows, timezone, errors, readOnly, onChange }: ExclusionsEditorProps) {
  const update = (index: number, patch: Partial<ExclusionRow>) => onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const zone = timezone || 'UTC';
  return (
    <fieldset className="space-y-2" data-testid="exclusions">
      <legend className="text-sm font-medium">Schedule exclusions (on the calendar's clock{timezone ? `, ${timezone}` : ''})</legend>
      {rows.map((row, index) => (
        <div key={index} className="space-y-1">
          <div className="grid items-end gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_10rem_auto]">
            <PlantDateTimeField id={`exclusion-${index}-from`} label={`Start of exclusion ${index + 1}`} value={row.from} timezone={zone} disabled={readOnly} onChange={(v) => update(index, { from: v })} />
            <PlantDateTimeField id={`exclusion-${index}-to`} label={`End of exclusion ${index + 1}`} value={row.to} timezone={zone} disabled={readOnly} onChange={(v) => update(index, { to: v })} />
            <Input aria-label={`Reason of exclusion ${index + 1}`} value={row.reason} disabled={readOnly} onChange={(e) => update(index, { reason: e.target.value })} />
            <NativeSelect id={`exclusion-${index}-kind`} ariaLabel={`Kind of exclusion ${index + 1}`} value={row.kind} options={KINDS} disabled={readOnly} onChange={(v) => update(index, { kind: v as ExclusionKind })} />
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
