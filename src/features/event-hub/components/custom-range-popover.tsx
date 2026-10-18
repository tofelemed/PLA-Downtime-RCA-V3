import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DateRangeInput } from '@/features/ux-kit/date-inputs';
import { useCalendarPreference } from '@/lib/dates';

export interface InstantBounds {
  from: string | null;
  to: string | null;
}

export interface CustomRangePopoverProps {
  /** the list's current bounds, the starting point of the custom range */
  value: InstantBounds;
  timeZone: string;
  onApply: (range: { from: string; to: string }) => void;
}

/** E-2 "Custom range…": start and end on the plant clock; applied as explicit (absolute) bounds. */
export function CustomRangePopover({ value, timeZone, onApply }: CustomRangePopoverProps) {
  const preference = useCalendarPreference();
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<InstantBounds>(value);
  const toggle = (next: boolean) => {
    if (next) setRange(value);
    setOpen(next);
  };
  const { from, to } = range;
  const ready = from !== null && to !== null && Date.parse(from) < Date.parse(to);
  const apply = () => {
    if (!from || !to || !ready) return;
    onApply({ from, to });
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={toggle}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" data-testid="event-window-custom">
          Custom range…
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="start">
        <DateRangeInput label="Custom range (plant time)" mode="datetime" value={range} timeZone={timeZone} calendar={preference.calendar} onChange={setRange} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" size="sm" disabled={!ready} onClick={apply} data-testid="event-window-custom-apply">
            Apply range
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
