import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { FieldErrors } from '../model/profile-form';
import type { TemplateRow } from '../model/calendar-draft';

export interface ShiftTemplatesEditorProps {
  rows: TemplateRow[];
  errors: FieldErrors;
  readOnly: boolean;
  onChange: (rows: TemplateRow[]) => void;
}

const FIELDS: ReadonlyArray<[key: keyof TemplateRow, label: string, apiField: string]> = [
  ['name', 'Name', 'name'],
  ['startLocal', 'Start (local)', 'startLocal'],
  ['endLocal', 'End (local)', 'endLocal'],
  ['days', 'ISO weekdays (empty = all)', 'daysOfWeek'],
];

/** Shift templates: an end at or before the start crosses midnight (equal = 24 h), as the server reads it. */
export function ShiftTemplatesEditor({ rows, errors, readOnly, onChange }: ShiftTemplatesEditorProps) {
  const update = (index: number, key: keyof TemplateRow, value: string) => onChange(rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  return (
    <fieldset className="space-y-2" data-testid="shift-templates">
      <legend className="text-sm font-medium">Shift templates</legend>
      {errors.shiftTemplates && <p className="text-xs text-destructive">{errors.shiftTemplates}</p>}
      {rows.map((row, index) => {
        const rowErrors = FIELDS.map(([, , api]) => errors[`shiftTemplates.${index}.${api}`]).filter(Boolean);
        const crosses = row.endLocal && row.startLocal && row.endLocal <= row.startLocal;
        return (
          <div key={index} className="space-y-1" data-testid="shift-template-row">
            <div className="grid grid-cols-[repeat(4,minmax(0,1fr))_auto] items-end gap-2">
              {FIELDS.map(([key, label]) => (
                <Input
                  key={key}
                  aria-label={`${label} of shift ${index + 1}`}
                  value={row[key]}
                  placeholder={key === 'startLocal' || key === 'endLocal' ? 'HH:mm' : undefined}
                  disabled={readOnly}
                  onChange={(event) => update(index, key, event.target.value)}
                />
              ))}
              {!readOnly && (
                <Button type="button" size="sm" variant="ghost" onClick={() => onChange(rows.filter((_, i) => i !== index))} aria-label={`Remove shift ${index + 1}`}>
                  Remove
                </Button>
              )}
            </div>
            {crosses && <p className="text-xs text-muted-foreground">Crosses midnight{row.endLocal === row.startLocal ? ' (24 h)' : ''}.</p>}
            {rowErrors.map((message) => (
              <p key={message} className="text-xs text-destructive">
                {message}
              </p>
            ))}
          </div>
        );
      })}
      {!readOnly && (
        <Button type="button" size="sm" variant="outline" onClick={() => onChange([...rows, { name: '', startLocal: '', endLocal: '', days: '' }])}>
          Add shift
        </Button>
      )}
    </fieldset>
  );
}
