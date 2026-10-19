import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DateTimeInput } from '@/features/ux-kit/date-inputs';
import { DisabledReason } from '@/features/ux-kit/disabled-reason';
import { useCalendarPreference } from '@/lib/dates';
import { customRangeProblem, ORDER_MESSAGE, type InstantBounds } from '../model/custom-range';

export interface CustomRangePopoverProps {
  /** the list's current bounds, the starting point of the custom range */
  value: InstantBounds;
  timeZone: string;
  onApply: (range: { from: string; to: string }) => void;
}

/**
 * E-2 "Custom range…": start and end on the plant clock; applied as explicit (absolute) bounds. The two fields
 * keep what is typed, even a reversed range, so "Apply range" is disabled while the range shown is not valid.
 */
export function CustomRangePopover({ value, timeZone, onApply }: CustomRangePopoverProps) {
  const preference = useCalendarPreference();
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<InstantBounds>(value);
  const toggle = (next: boolean) => {
    if (next) setRange(value);
    setOpen(next);
  };
  const problem = customRangeProblem(range);
  const apply = () => {
    if (problem || !range.from || !range.to) return;
    onApply({ from: range.from, to: range.to });
    setOpen(false);
  };
  const common = { timeZone, calendar: preference.calendar };
  return (
    <Popover open={open} onOpenChange={toggle}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" data-testid="event-window-custom">
          Custom range…
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="start">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium leading-none">Custom range (plant time)</legend>
          <DateTimeInput label="From" value={range.from} onChange={(from) => setRange((current) => ({ ...current, from }))} {...common} />
          <DateTimeInput label="To" value={range.to} error={problem === ORDER_MESSAGE ? problem : null} onChange={(to) => setRange((current) => ({ ...current, to }))} {...common} />
        </fieldset>
        {problem !== ORDER_MESSAGE && <DisabledReason id="custom-range-blocked" reason={problem} />}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" size="sm" disabled={problem !== null} aria-describedby={problem && problem !== ORDER_MESSAGE ? 'custom-range-blocked' : undefined} onClick={apply} data-testid="event-window-custom-apply">
            Apply range
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
