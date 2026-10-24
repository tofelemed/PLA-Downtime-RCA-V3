import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { WINDOW_PRESETS } from '@/features/downtime-analysis/model/downtime-filters';
import { useCalendarPreference } from '@/lib/dates';
import { UiIcon } from '@/lib/icons';
import { CHOSEN_DATES, presetWindowOf, type AnalyticsScope } from '../model/analytics-scope';
import { windowRangeText } from '../model/window-range';
import { PlantDaysInput } from './plant-days-input';
import { useProductionDayStart } from '../hooks/use-production-day-start';

export interface WindowRangeControlProps {
  scope: AnalyticsScope;
  timeZone: string;
  onChange: (patch: Partial<AnalyticsScope>) => void;
}

/**
 * One window control (UX audit D-13), labelled above: the button says the window on the plant calendar; it
 * opens the rolling presets and the plant-date range (From / To) together. A preset takes its instant when chosen, never during render.
 */
export function WindowRangeControl({ scope, timeZone, onChange }: WindowRangeControlProps) {
  const pref = useCalendarPreference();
  const { dayStart } = useProductionDayStart();
  const [open, setOpen] = useState(false);
  const text = windowRangeText(scope, scope.windowLabel, { timeZone, dayStart }, pref);
  const choosePreset = (hours: number, label: string) => {
    onChange({ ...presetWindowOf(hours), windowLabel: label });
    setOpen(false);
  };
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="pla-window">Window</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button id="pla-window" type="button" variant="outline" size="sm" className="h-9 gap-1" data-testid="pla-window" aria-label={`Window: ${text}`}>
            <span className="font-medium">{text}</span>
            <UiIcon.chevronDown aria-hidden="true" className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto space-y-3" data-testid="pla-window-panel">
          <div className="flex flex-wrap gap-1" role="group" aria-label="Rolling windows">
            {WINDOW_PRESETS.map((preset) => (
              <Button key={preset.key} type="button" size="sm" variant={scope.windowLabel === preset.label ? 'secondary' : 'ghost'} data-testid={`pla-window-${preset.key}`} onClick={() => choosePreset(preset.hours, preset.label)}>
                {preset.label}
              </Button>
            ))}
          </div>
          <PlantDaysInput label="Period dates" value={{ from: scope.from, to: scope.to }} timeZone={timeZone} dayStart={dayStart} toLabel="To" onChange={(range) => onChange({ ...range, windowLabel: CHOSEN_DATES })} />
        </PopoverContent>
      </Popover>
    </div>
  );
}
