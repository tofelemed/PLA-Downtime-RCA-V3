import type { ReactNode } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { labelOf, SCHEDULE_CLASS_LABELS } from '@/features/ux-kit/labels';
import { FIELD_CLASS, SELECT_CLASS } from '@/features/pla-analytics/components/analytics-filters';
import { MultiCheckSelect } from '@/features/event-hub/components/multi-check-select';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import {
  SCHEDULE_FILTERS,
  TREND_GROUPS,
  type DowntimeFilters,
  type ScheduleFilter,
  type TrendGroup,
} from '../model/downtime-filters';
import { PeriodSelectionFilters } from './period-selection-filters';
import { ProductionDateRange } from './production-date-range';
import { WindowPresetSelect } from './window-preset-select';

export interface DowntimeFiltersBarProps {
  scope?: 'period' | 'output' | 'operational' | 'reliability';
  showTrend?: boolean;
  showSchedule?: boolean;
  /** the page's focused analysis select (Show / Rank by / Compare), right after the units */
  mode?: ReactNode;
  filters: DowntimeFilters;
  onChange: (patch: Partial<DowntimeFilters>) => void;
}

type Patch = (patch: Partial<DowntimeFilters>) => void;

const classLabel = (value: string) => (value === 'all' ? 'All classes' : labelOf(SCHEDULE_CLASS_LABELS, value));
const trendLabel = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/**
 * Server-side filters of every widget (plan 3.3) in one bottom-aligned row, labels above: units, then what
 * (the page's analysis, products / shifts / crews, schedule class), then the window and its dates, then the
 * trend step, micro-stops and approval. Filters that do not apply to the page's figures are not offered.
 */
export function DowntimeFiltersBar({ filters, onChange, scope = 'period', showTrend = true, showSchedule = true, mode }: DowntimeFiltersBarProps) {
  const env = useEventHubEnv();
  return (
    <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Downtime filters" data-testid="downtime-filters">
      <MultiCheckSelect
        label="Units"
        testId="filter-units"
        options={env.units.map((unit) => ({ value: unit.id, label: unit.name }))}
        selected={filters.unitIds}
        onChange={(unitIds) => onChange({ unitIds: [...unitIds].sort() })}
        commitOnClose
      />
      {mode}
      {scope === 'period' && <PeriodSelectionFilters filters={filters} onChange={onChange} />}
      {showSchedule && (scope === 'period' || scope === 'operational') && <ScheduleSelect value={filters.scheduleClass} onChange={onChange} />}
      <WindowPresetSelect filters={filters} onChange={onChange} />
      <ProductionDateRange from={filters.from} to={filters.to} timeZone={env.timezone} onChange={(range) => onChange({ ...range, windowLabel: 'Chosen dates', relativeWindow: null })} />
      {showTrend && <TrendSelect value={filters.trendBy} onChange={onChange} />}
      <ScopeToggles scope={scope} filters={filters} onChange={onChange} />
    </div>
  );
}

/** Micro-stops for period figures; approval wherever figures come from period revisions (not operational stops). */
function ScopeToggles({ scope, filters, onChange }: { scope: NonNullable<DowntimeFiltersBarProps['scope']>; filters: DowntimeFilters; onChange: Patch }) {
  return (
    <>
      {scope === 'period' && <Toggle id="downtime-micro" text="Include micro-stops" checked={filters.includeMicroStops} onChange={(includeMicroStops) => onChange({ includeMicroStops })} />}
      {scope !== 'operational' && <Toggle id="downtime-approved" text="Approved only" checked={filters.approvedOnly} onChange={(approvedOnly) => onChange({ approvedOnly })} />}
    </>
  );
}

function ScheduleSelect({ value, onChange }: { value: ScheduleFilter; onChange: Patch }) {
  return (
    <div className={FIELD_CLASS}>
      <Label htmlFor="downtime-class">Schedule class</Label>
      <select id="downtime-class" className={SELECT_CLASS} value={value} onChange={(event) => onChange({ scheduleClass: event.target.value as ScheduleFilter })}>
        {SCHEDULE_FILTERS.map((entry) => (
          <option key={entry} value={entry}>
            {classLabel(entry)}
          </option>
        ))}
      </select>
    </div>
  );
}

function TrendSelect({ value, onChange }: { value: TrendGroup; onChange: Patch }) {
  return (
    <div className={FIELD_CLASS}>
      <Label htmlFor="downtime-trend">Trend by</Label>
      <select id="downtime-trend" className={SELECT_CLASS} value={value} onChange={(event) => onChange({ trendBy: event.target.value as TrendGroup })}>
        {TREND_GROUPS.map((entry) => (
          <option key={entry} value={entry}>
            {trendLabel(entry)}
          </option>
        ))}
      </select>
    </div>
  );
}

function Toggle({ id, text, checked, onChange }: { id: string; text: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex h-9 items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(value) => onChange(value === true)} />
      <Label htmlFor={id}>{text}</Label>
    </div>
  );
}
