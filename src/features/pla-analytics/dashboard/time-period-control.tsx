import { useId } from 'react';
import { cn } from '@/lib/utils';
import { DASHBOARD_PRESETS, type DashboardPresetKey } from '../model/dashboard-scope';

export interface TimePeriodControlProps {
  value: DashboardPresetKey;
  onChange: (key: DashboardPresetKey) => void;
}

/** The dashboard's period as one segmented radio group: arrow keys move between the options, the chosen one is filled. */
export function TimePeriodControl({ value, onChange }: TimePeriodControlProps) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label="Time period" data-testid="dashboard-window" className="inline-flex flex-wrap rounded-md border bg-card p-0.5">
      {DASHBOARD_PRESETS.map((preset) => (
        <label key={preset.key} className="relative cursor-pointer">
          <input
            type="radio"
            name={name}
            value={preset.key}
            checked={preset.key === value}
            onChange={() => onChange(preset.key)}
            className="peer sr-only"
          />
          <span
            className={cn(
              'block whitespace-nowrap rounded px-3 py-1 text-sm font-medium text-muted-foreground hover:text-foreground',
              'peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring',
            )}
          >
            {preset.label}
          </span>
        </label>
      ))}
    </div>
  );
}
