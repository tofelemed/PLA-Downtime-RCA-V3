import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { MultiCheckSelect } from '@/features/event-hub/components/multi-check-select';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { WINDOW_PRESETS } from '@/features/downtime-analysis/model/downtime-filters';
import { presetWindowOf, type AnalyticsScope } from '../model/analytics-scope';
import { SiteFilter } from './site-filter';

export interface AnalyticsFiltersProps {
  scope: AnalyticsScope;
  onChange: (patch: Partial<AnalyticsScope>) => void;
}

export const SELECT_CLASS = 'h-9 rounded-md border border-input bg-background px-2 text-sm';

/** Scope filters shared by every view (server-side): site (selects its units), units (sent when the list closes), window, ledger, approved only. */
export function AnalyticsFilters({ scope, onChange }: AnalyticsFiltersProps) {
  const env = useEventHubEnv();
  const choosePreset = (key: string) => {
    const preset = WINDOW_PRESETS.find((entry) => entry.key === key);
    if (preset) onChange({ ...presetWindowOf(preset.hours), windowLabel: preset.label });
  };
  return (
    <div className="flex flex-wrap items-center gap-3" role="group" aria-label="Analytics scope" data-testid="analytics-filters">
      <SiteFilter unitIds={scope.unitIds} onChange={(unitIds) => onChange({ unitIds })} />
      <MultiCheckSelect
        label="Units"
        testId="filter-units"
        options={env.units.map((unit) => ({ value: unit.id, label: unit.name }))}
        selected={scope.unitIds}
        onChange={(unitIds) => onChange({ unitIds: [...unitIds].sort() })}
        commitOnClose
      />
      <div className="flex items-center gap-2">
        <Label htmlFor="pla-window">Window</Label>
        <select id="pla-window" data-testid="pla-window" className={SELECT_CLASS} value="" onChange={(event) => choosePreset(event.target.value)}>
          <option value="" disabled>
            {scope.windowLabel}
          </option>
          {WINDOW_PRESETS.map((preset) => (
            <option key={preset.key} value={preset.key}>
              {preset.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2" role="radiogroup" aria-labelledby="pla-ledger-label">
        <span id="pla-ledger-label" className="text-sm font-medium">
          Ledger
        </span>
        {(['plan', 'capacity'] as const).map((ledger) => (
          <label key={ledger} className="flex items-center gap-1 text-sm">
            <input type="radio" name="pla-ledger" value={ledger} checked={scope.ledger === ledger} onChange={() => onChange({ ledger })} data-testid={`ledger-${ledger}`} />
            {ledger === 'plan' ? 'Plan' : 'Capacity'}
          </label>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="pla-approved" checked={scope.approvedOnly} onCheckedChange={(value) => onChange({ approvedOnly: value === true })} data-testid="pla-approved" />
        <Label htmlFor="pla-approved">Approved only</Label>
      </div>
    </div>
  );
}
