import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { mapOfRows, type MapRow } from './model/profile-draft';
import { STATE_NAME_SUGGESTIONS, type ValueMapKind } from './model/value-map-classify';
import { ValueMapProbe } from './value-map-probe';

export interface ValueMapEditorProps {
  kind: ValueMapKind;
  rows: MapRow[];
  error?: string;
  /** reason maps: `reasonUnmapped: keep` */
  keepUnmapped?: boolean;
  onChange: (rows: MapRow[]) => void;
}

const TITLE: Record<ValueMapKind, { label: string; target: string; hint: string }> = {
  state: { label: 'State value map', target: 'DT01 state', hint: 'Raw state token (number, name or {"name"}) → state name; running or stopped must stay reachable. No map = tokens pass through unmapped.' },
  reason: { label: 'Reason value map', target: 'code library key', hint: 'Raw reason token → code library key. Unmapped tokens are quarantined (unmapped_value) unless "keep" is chosen above.' },
};

/** Token → value rows of one value map with the live probe ("what would this token become?"). */
export function ValueMapEditor({ kind, rows, error, keepUnmapped, onChange }: ValueMapEditorProps) {
  const text = TITLE[kind];
  const edit = (index: number, patch: Partial<MapRow>) => onChange(rows.map((row, at) => (at === index ? { ...row, ...patch } : row)));
  const remove = (index: number) => onChange(rows.filter((_row, at) => at !== index));
  return (
    <fieldset className="space-y-2 rounded-md border p-3" data-testid={`value-map-${kind}`}>
      <legend className="px-1 text-sm font-medium">
        {text.label} ({rows.length})
      </legend>
      <p className="text-xs text-muted-foreground">{text.hint}</p>
      {rows.map((row, index) => (
        <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 text-xs" data-testid={`${kind}-map-row`}>
          <Input aria-label="Raw token" className="font-mono" value={row.token} onChange={(event) => edit(index, { token: event.target.value })} />
          <Input aria-label={text.target} list={kind === 'state' ? 'dt01-state-names' : undefined} value={row.value} onChange={(event) => edit(index, { value: event.target.value })} />
          <Button size="sm" variant="ghost" onClick={() => remove(index)} aria-label={`Remove ${kind} mapping ${row.token || index + 1}`}>
            Remove
          </Button>
        </div>
      ))}
      {kind === 'state' && (
        <datalist id="dt01-state-names">
          {STATE_NAME_SUGGESTIONS.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive" data-testid={`${kind}-map-error`}>
          {error}
        </p>
      )}
      <Button size="sm" variant="outline" onClick={() => onChange([...rows, { token: '', value: '' }])} data-testid={`${kind}-map-add`}>
        Add mapping
      </Button>
      <ValueMapProbe kind={kind} map={mapOfRows(rows)} keepUnmapped={keepUnmapped} />
    </fieldset>
  );
}
