import { Label } from '@/components/ui/label';
import { FIELD_CLASS, SELECT_CLASS } from '@/features/pla-analytics/components/analytics-filters';
import { presetWindow, WINDOW_PRESETS, type DowntimeFilters } from '../model/downtime-filters';

/** The rolling window presets of the downtime pages; a chosen preset is the selected option, never repeated as a placeholder (QA L1). */
export function WindowPresetSelect({ filters, onChange }: { filters: DowntimeFilters; onChange: (patch: Partial<DowntimeFilters>) => void }) {
  const shown = WINDOW_PRESETS.find((entry) => entry.key === filters.relativeWindow)?.key ?? '';
  const choose = (key: string) => {
    const preset = WINDOW_PRESETS.find((entry) => entry.key === key);
    if (preset) onChange({ ...presetWindow(preset.hours, Date.now()), windowLabel: preset.label, relativeWindow: preset.key });
  };
  return (
    <div className={FIELD_CLASS}>
      <Label htmlFor="downtime-window">Window</Label>
      <select id="downtime-window" data-testid="downtime-window" className={SELECT_CLASS} value={shown} onChange={(event) => choose(event.target.value)}>
        {!shown && (
          <option value="" disabled>
            {filters.windowLabel}
          </option>
        )}
        {WINDOW_PRESETS.map((preset) => (
          <option key={preset.key} value={preset.key}>
            {preset.label}
          </option>
        ))}
      </select>
    </div>
  );
}
