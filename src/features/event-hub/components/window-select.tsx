import { Label } from '@/components/ui/label';
import { FIELD_CLASS, SELECT_CLASS } from '@/features/pla-analytics/components/analytics-filters';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import type { ShiftInstanceView } from '@/api/v2/types/units';
import { formatOperationalDate, useCalendarPreference } from '@/lib/dates';
import { presetWindow, WINDOW_PRESETS } from '../model/event-filters';
import type { RelativeWindowKey } from '../model/relative-window';
import { usePlantFormat } from '../hooks/use-plant-format';
import { useShiftWindows } from '../hooks/use-shift-windows';
import type { InstantBounds } from '../model/custom-range';
import { CustomRangePopover } from './custom-range-popover';

export interface ChosenWindow {
  from: string;
  to: string;
  label: string;
  /** a rolling preset (kept relative in the URL); absent for a shift or a custom range */
  relative?: RelativeWindowKey | null;
}

export interface WindowSelectProps {
  /** the units of the filter; the shift list needs exactly one (shift instances are per unit) */
  unitIds: readonly string[];
  label: string;
  /** current bounds of the list (the custom range starts from them) */
  bounds: InstantBounds;
  onChange: (window: ChosenWindow) => void;
}

const CURRENT_SHIFT = 'current-shift';

function shiftHint(unitCount: number): string | null {
  if (unitCount === 1) return null;
  return unitCount === 0 ? 'Choose one unit to pick a shift.' : 'Shifts are listed for one unit at a time.';
}

/**
 * Window of the list (UX04 "choose unit and shift", E-2): a rolling preset (resolved from now on every
 * fetch, A-5), the current or a recent shift of the one chosen unit, or a custom range on the plant clock.
 * Two items of the filter bar (the labelled select, then "Custom range…"); why no shift is offered is the
 * ⓘ next to the label. Instants are taken when the user picks, never during render.
 */
export function WindowSelect({ unitIds, label, bounds, onChange }: WindowSelectProps) {
  const { dateTime, timezone } = usePlantFormat();
  const preference = useCalendarPreference();
  const unitId = unitIds.length === 1 ? unitIds[0] : null;
  const { instances, current } = useShiftWindows(unitId);
  const shiftLabel = (shift: ShiftInstanceView) => `${formatOperationalDate(shift.localDate, preference)} ${shift.shiftName}`;
  const hint = shiftHint(unitIds.length);
  // QA L1: the current preset is the selected option, never repeated as a placeholder
  const shownPreset = WINDOW_PRESETS.find((entry) => entry.label === label);
  const selected = shownPreset ? `preset:${shownPreset.key}` : '';

  const choose = (value: string) => {
    const preset = WINDOW_PRESETS.find((entry) => `preset:${entry.key}` === value);
    if (preset) return onChange({ ...presetWindow(preset.hours, preset.label, Date.now()), relative: preset.key });
    const shift = value === CURRENT_SHIFT ? current : instances.find((entry) => `shift:${entry.utcStart}` === value);
    if (shift) onChange({ from: shift.utcStart, to: shift.utcEnd, label: value === CURRENT_SHIFT ? `Current shift (${shift.shiftName})` : shiftLabel(shift) });
  };

  return (
    <>
      <div className={FIELD_CLASS}>
        <span className="flex items-center gap-1">
          <Label htmlFor="event-window">Window</Label>
          {hint && <KpiInfo label="Window" text={hint} />}
        </span>
        <select id="event-window" data-testid="event-window" className={SELECT_CLASS} value={selected} onChange={(event) => choose(event.target.value)}>
          {!shownPreset && (
            <option value="" disabled>
              {label}
            </option>
          )}
          {WINDOW_PRESETS.map((preset) => (
            <option key={preset.key} value={`preset:${preset.key}`}>
              {preset.label}
            </option>
          ))}
          {current && <option value={CURRENT_SHIFT}>{`Current shift (${current.shiftName})`}</option>}
          {instances.length > 0 && (
            <optgroup label="Shifts">
              {instances.map((shift) => (
                <option key={shift.utcStart} value={`shift:${shift.utcStart}`}>
                  {`${shiftLabel(shift)} · ${dateTime(shift.utcStart)}`}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>
      <CustomRangePopover value={bounds} timeZone={timezone} onApply={(range) => onChange({ ...range, label: 'Custom range' })} />
    </>
  );
}
