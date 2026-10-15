import type { PhysicalState, StateRule } from '@/api/v2/types/reliability';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SELECT_CLASS } from '../shared/use-asset-lookup';
import { PHYSICAL_STATES, STATE_LABELS } from './mapping-editor-model';

export interface StateRulesEditorProps {
  rules: StateRule[];
  onChange: (index: number, change: Partial<StateRule>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  error?: string;
}

/** Signal value → physical state, one row per value; values not listed are unknown time (data quality). */
export function StateRulesEditor({ rules, onChange, onAdd, onRemove, error }: StateRulesEditorProps) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Signal value → state</legend>
      {rules.map((rule, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2" data-testid="state-rule">
          <Input
            className="w-48"
            aria-label={`Signal value ${i + 1}`}
            value={rule.match}
            placeholder="RUN"
            onChange={(e) => onChange(i, { match: e.target.value })}
          />
          <select
            aria-label={`State ${i + 1}`}
            className={`${SELECT_CLASS} w-56`}
            value={rule.state}
            onChange={(e) => onChange(i, { state: e.target.value as PhysicalState })}
          >
            {PHYSICAL_STATES.map((s) => <option key={s} value={s}>{STATE_LABELS[s]}</option>)}
          </select>
          <Button type="button" size="sm" variant="ghost" disabled={rules.length === 1} onClick={() => onRemove(i)}>Remove</Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={onAdd}>Add a value</Button>
      <p className="text-xs text-muted-foreground">A value not listed here counts as unknown time, never as running or stopped.</p>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </fieldset>
  );
}
