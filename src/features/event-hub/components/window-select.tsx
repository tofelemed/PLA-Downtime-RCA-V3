import { useState } from 'react';
import { useShiftInstances } from '@/api/v2/queries/units';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { Label } from '@/components/ui/label';
import { formatPlantTime } from '@/features/ux-kit/format/plant-time';
import { presetWindow, WINDOW_PRESETS } from '../model/event-filters';
import { useEventHubEnv } from '../use-event-hub-env';

export interface ChosenWindow {
  from: string;
  to: string;
  label: string;
}

export interface WindowSelectProps {
  /** the shift list needs exactly one unit (shift instances are per unit) */
  unitId: string | null;
  label: string;
  onChange: (window: ChosenWindow) => void;
}

const DAY_MS = 86_400_000;

/**
 * Window of the list: a preset ending now or one shift of the chosen unit (UX04 "choose unit and
 * shift"). Instants are taken when the user picks, never during render.
 */
export function WindowSelect({ unitId, label, onChange }: WindowSelectProps) {
  const { timezone } = useEventHubEnv();
  const [range] = useState(() => {
    const now = Date.now();
    return { from: new Date(now - 3 * DAY_MS).toISOString(), to: new Date(now + DAY_MS).toISOString() };
  });
  const shifts = useShiftInstances(unitId ? { unitId, ...range } : null);
  const instances = flattenPages(shifts.data?.pages).filter((shift) => !shift.isExcluded);

  const choose = (value: string) => {
    const preset = WINDOW_PRESETS.find((entry) => `preset:${entry.hours}` === value);
    if (preset) return onChange(presetWindow(preset.hours, preset.label, Date.now()));
    const shift = instances.find((entry) => `shift:${entry.utcStart}` === value);
    if (shift) onChange({ from: shift.utcStart, to: shift.utcEnd, label: `${shift.localDate} ${shift.shiftName}` });
  };

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="event-window" className="text-sm">
        Window
      </Label>
      <select
        id="event-window"
        data-testid="event-window"
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        value=""
        onChange={(event) => choose(event.target.value)}
      >
        <option value="" disabled>
          {label}
        </option>
        {WINDOW_PRESETS.map((preset) => (
          <option key={preset.hours} value={`preset:${preset.hours}`}>
            {preset.label}
          </option>
        ))}
        {instances.length > 0 && (
          <optgroup label="Shifts">
            {instances.map((shift) => (
              <option key={shift.utcStart} value={`shift:${shift.utcStart}`}>
                {`${shift.localDate} ${shift.shiftName} · ${formatPlantTime(shift.utcStart, timezone)}`}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </div>
  );
}
