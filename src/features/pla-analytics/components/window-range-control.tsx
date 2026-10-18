import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DateRangeInput } from '@/features/ux-kit/date-inputs';
import { WINDOW_PRESETS } from '@/features/downtime-analysis/model/downtime-filters';
import { useCalendarPreference } from '@/lib/dates';
import { UiIcon } from '@/lib/icons';
import { presetWindowOf, type AnalyticsScope } from '../model/analytics-scope';
import { windowRangeText } from '../model/window-range';

export interface WindowRangeControlProps {
  scope: AnalyticsScope;
  timeZone: string;
  onChange: (patch: Partial<AnalyticsScope>) => void;
}

/**
 * One window control (UX audit D-13): the button says the window on the plant calendar; it opens the rolling
 * presets and the plant-date range together. A preset takes its instant when chosen, never during render.
 */
export function WindowRangeControl({ scope, timeZone, onChange }: WindowRangeControlProps) {
  const pref = useCalendarPreference();
  const [open, setOpen] = useState(false);
  const choosePreset = (hours: number, label: string) => {
    onChange({ ...presetWindowOf(hours), windowLabel: label });
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-9 gap-1" data-testid="pla-window" aria-label={`Window: ${windowRangeText(scope, scope.windowLabel, timeZone, pref)}`}>
          <span className="text-muted-foreground">Window</span>
          <span className="font-medium">{windowRangeText(scope, scope.windowLabel, timeZone, pref)}</span>
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
        <DateRangeInput label="Period dates" value={{ from: scope.from, to: scope.to }} timeZone={timeZone} onChange={(range) => {
          if (range.from && range.to) onChange({ from: range.from, to: range.to, windowLabel: 'Chosen dates' });
        }} />
      </PopoverContent>
    </Popover>
  );
}
