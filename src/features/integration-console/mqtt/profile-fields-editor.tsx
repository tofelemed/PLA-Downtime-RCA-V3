import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ProfileKind } from './model/mqtt-form';
import { FIELD_DEFAULTS, type MapRow } from './model/profile-draft';

export interface ProfileFieldsEditorProps {
  kind: ProfileKind;
  rows: MapRow[];
  error?: string;
  onChange: (rows: MapRow[]) => void;
}

/**
 * Field overrides: dotted JSON paths per decoder field (the contract v1 defaults are the placeholders;
 * an override only matters for a non-contract source, since the v1 schemas refuse unknown properties).
 */
export function ProfileFieldsEditor({ kind, rows, error, onChange }: ProfileFieldsEditorProps) {
  const defaults = FIELD_DEFAULTS[kind];
  const unused = Object.keys(defaults).filter((name) => !rows.some((row) => row.token === name));
  const edit = (index: number, patch: Partial<MapRow>) => onChange(rows.map((row, at) => (at === index ? { ...row, ...patch } : row)));
  const remove = (index: number) => onChange(rows.filter((_row, at) => at !== index));
  return (
    <fieldset className="space-y-2 rounded-md border p-3" data-testid="profile-fields">
      <legend className="px-1 text-sm font-medium">Field overrides ({rows.length})</legend>
      {rows.map((row, index) => (
        <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 text-xs" data-testid="profile-field-row">
          <Input aria-label="Field" list="pp-field-names" value={row.token} onChange={(event) => edit(index, { token: event.target.value })} />
          <Input aria-label="JSON path" className="font-mono" placeholder={defaults[row.token] ?? 'dotted.path'} value={row.value} onChange={(event) => edit(index, { value: event.target.value })} />
          <Button size="sm" variant="ghost" onClick={() => remove(index)} aria-label={`Remove override ${row.token || index + 1}`}>
            Remove
          </Button>
        </div>
      ))}
      <datalist id="pp-field-names">
        {unused.map((name) => (
          <option key={name} value={name}>{`${name} (default ${defaults[name]})`}</option>
        ))}
      </datalist>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <Button size="sm" variant="outline" onClick={() => onChange([...rows, { token: unused[0] ?? '', value: '' }])} data-testid="profile-field-add">
        Add override
      </Button>
      <p className="text-xs text-muted-foreground">Defaults: {Object.entries(defaults).map(([name, path]) => `${name}=${path}`).join(', ')}</p>
    </fieldset>
  );
}
