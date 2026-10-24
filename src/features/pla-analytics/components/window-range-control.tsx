import { Label } from '@/components/ui/label';
import { WINDOW_PRESETS } from '@/features/downtime-analysis/model/downtime-filters';
import { CHOSEN_DATES, presetWindowOf, type AnalyticsScope } from '../model/analytics-scope';
import { FIELD_CLASS, SELECT_CLASS } from './filter-classes';
import { PlantDaysInput } from './plant-days-input';
import { useProductionDayStart } from '../hooks/use-production-day-start';

export interface WindowRangeControlProps {
  scope: AnalyticsScope;
  timeZone: string;
  onChange: (patch: Partial<AnalyticsScope>) => void;
}

/**
 * The window as on Reports and Downtime (cleanup 24 Oct 2026): a Window preset select (a chosen preset is the
 * selected option, "Chosen dates" a disabled placeholder once From / To were typed) and the plant-date From / To
 * fields with the plant-calendar picker. No dates inside the select. A preset takes its instant when chosen, never during render.
 */
export function WindowRangeControl({ scope, timeZone, onChange }: WindowRangeControlProps) {
  const { dayStart } = useProductionDayStart();
  const shown = WINDOW_PRESETS.find((preset) => preset.label === scope.windowLabel)?.key ?? '';
  const choosePreset = (key: string) => {
    const preset = WINDOW_PRESETS.find((entry) => entry.key === key);
    if (preset) onChange({ ...presetWindowOf(preset.hours), windowLabel: preset.label });
  };
  return (
    <>
      <div className={FIELD_CLASS}>
        <Label htmlFor="pla-window">Window</Label>
        <select id="pla-window" data-testid="pla-window" className={SELECT_CLASS} value={shown} onChange={(event) => choosePreset(event.target.value)}>
          {!shown && (
            <option value="" disabled>
              {scope.windowLabel || CHOSEN_DATES}
            </option>
          )}
          {WINDOW_PRESETS.map((preset) => (
            <option key={preset.key} value={preset.key}>
              {preset.label}
            </option>
          ))}
        </select>
      </div>
      <PlantDaysInput
        label="Period dates"
        value={{ from: scope.from, to: scope.to }}
        timeZone={timeZone}
        dayStart={dayStart}
        toLabel="To"
        calendarPicker
        toolbar
        onChange={(range) => onChange({ ...range, windowLabel: CHOSEN_DATES })}
      />
    </>
  );
}
