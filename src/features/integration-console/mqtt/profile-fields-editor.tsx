import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ProfileKind } from './model/mqtt-form';
import { FIELD_DEFAULTS, type MapRow } from './model/profile-draft';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

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
  const { number } = useNumberFormat();
  const defaults = FIELD_DEFAULTS[kind];
  const unused = Object.keys(defaults).filter((name) => !rows.some((row) => row.token === name));
  const edit = (index: number, patch: Partial<MapRow>) => onChange(rows.map((row, at) => (at === index ? { ...row, ...patch } : row)));
  const remove = (index: number) => onChange(rows.filter((_row, at) => at !== index));
  return (
    <fieldset className="space-y-2 rounded-md border p-3" data-testid="profile-fields">
      <legend className="px-1 text-sm font-medium">Field overrides ({number(rows.length)})</legend>
      {rows.map((row, index) => (
        <div key={index} className="grid min-w-0 gap-2 text-xs sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center" data-testid="profile-field-row">
          <Input aria-label="Field" aria-invalid={Boolean(error)} aria-describedby={error ? 'profile-fields-error' : undefined} list="pp-field-names" value={row.token} onChange={(event) => edit(index, { token: event.target.value })} />
          <Input aria-label="JSON path" aria-invalid={Boolean(error)} aria-describedby={error ? 'profile-fields-error' : undefined} className="min-w-0 font-mono" placeholder={defaults[row.token] ?? 'dotted.path'} value={row.value} onChange={(event) => edit(index, { value: event.target.value })} />
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
        <p id="profile-fields-error" role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <Button size="sm" variant="outline" onClick={() => onChange([...rows, { token: unused[0] ?? '', value: '' }])} data-testid="profile-field-add">
        Add override
      </Button>
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">Default field paths</summary>
        <dl className="mt-2 grid min-w-0 gap-x-4 gap-y-1 sm:grid-cols-2">
          {Object.entries(defaults).map(([name, path]) => <div key={name} className="min-w-0"><dt>{name}</dt><dd className="break-all font-mono">{path}</dd></div>)}
        </dl>
      </details>
    </fieldset>
  );
}
