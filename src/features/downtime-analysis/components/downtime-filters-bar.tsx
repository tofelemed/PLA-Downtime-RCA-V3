import { Checkbox } from '@/components/ui/checkbox';
import { DateRangeInput } from '@/features/ux-kit/date-inputs';
import { Label } from '@/components/ui/label';
import { labelOf, SCHEDULE_CLASS_LABELS } from '@/features/ux-kit/labels';
import { MultiCheckSelect } from '@/features/event-hub/components/multi-check-select';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import {
  presetWindow,
  SCHEDULE_FILTERS,
  TREND_GROUPS,
  WINDOW_PRESETS,
  type DowntimeFilters,
  type ScheduleFilter,
  type TrendGroup,
} from '../model/downtime-filters';
import { PeriodSelectionFilters } from './period-selection-filters';

export interface DowntimeFiltersBarProps {
  scope?: 'period' | 'output' | 'operational' | 'reliability';
  showTrend?: boolean;
  showSchedule?: boolean;
  filters: DowntimeFilters;
  onChange: (patch: Partial<DowntimeFilters>) => void;
}

const SELECT = 'h-9 rounded-md border border-input bg-background px-2 text-sm';
const label = (value: string) => labelOf(SCHEDULE_CLASS_LABELS, value);
const trendLabel = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/**
 * Server-side filters of every widget (plan 3.3): units, products / shifts / crews (period selection of the
 * downtime summary and breakdowns), window, schedule class, micro-stops, approval.
 */
export function DowntimeFiltersBar({ filters, onChange, scope = 'period', showTrend = true, showSchedule = true }: DowntimeFiltersBarProps) {
  const env = useEventHubEnv();
  const choosePreset = (key: string) => {
    const preset = WINDOW_PRESETS.find((entry) => entry.key === key);
    if (preset) onChange({ ...presetWindow(preset.hours, Date.now()), windowLabel: preset.label });
  };
  return (
    <div className="flex flex-wrap items-center gap-3" role="group" aria-label="Downtime filters" data-testid="downtime-filters">
      <MultiCheckSelect
        label="Units"
        testId="filter-units"
        options={env.units.map((unit) => ({ value: unit.id, label: unit.name }))}
        selected={filters.unitIds}
        onChange={(unitIds) => onChange({ unitIds: [...unitIds].sort() })}
        commitOnClose
      />
      {scope === 'period' && <PeriodSelectionFilters filters={filters} onChange={onChange} />}
      <DateRangeInput label="Period dates" value={{ from: filters.from, to: filters.to }} timeZone={env.timezone} onChange={(range) => {
        if (range.from && range.to) onChange({ from: range.from, to: range.to, windowLabel: 'Chosen dates' });
      }} />
      <div className="flex items-center gap-2">
        <Label htmlFor="downtime-window">Window</Label>
        <select id="downtime-window" data-testid="downtime-window" className={SELECT} value="" onChange={(event) => choosePreset(event.target.value)}>
          <option value="" disabled>
            {filters.windowLabel}
          </option>
          {WINDOW_PRESETS.map((preset) => (
            <option key={preset.key} value={preset.key}>
              {preset.label}
            </option>
          ))}
        </select>
      </div>
      {showSchedule && (scope === 'period' || scope === 'operational') && <div className="flex items-center gap-2">
        <Label htmlFor="downtime-class">Schedule class</Label>
        <select
          id="downtime-class"
          className={SELECT}
          value={filters.scheduleClass}
          onChange={(event) => onChange({ scheduleClass: event.target.value as ScheduleFilter })}
        >
          {SCHEDULE_FILTERS.map((value) => (
            <option key={value} value={value}>
              {value === 'all' ? 'All classes' : label(value)}
            </option>
          ))}
        </select>
      </div>}
      {showTrend && <div className="flex items-center gap-2">
        <Label htmlFor="downtime-trend">Trend by</Label>
        <select id="downtime-trend" className={SELECT} value={filters.trendBy} onChange={(event) => onChange({ trendBy: event.target.value as TrendGroup })}>
          {TREND_GROUPS.map((value) => (
            <option key={value} value={value}>
              {trendLabel(value)}
            </option>
          ))}
        </select>
      </div>}
      {scope === 'period' && <Toggle id="downtime-micro" text="Include micro-stops" checked={filters.includeMicroStops} onChange={(includeMicroStops) => onChange({ includeMicroStops })} />}
      {scope !== 'operational' && <Toggle id="downtime-approved" text="Approved only" checked={filters.approvedOnly} onChange={(approvedOnly) => onChange({ approvedOnly })} />}
    </div>
  );
}

function Toggle({ id, text, checked, onChange }: { id: string; text: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(value) => onChange(value === true)} />
      <Label htmlFor={id}>{text}</Label>
    </div>
  );
}
