import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { type CalendarSystem, type DigitSystem, useCalendarPreference } from '@/lib/dates';
import { UiIcon } from '@/lib/icons';
import { useActingTenant } from '@/features/settings/use-tenant-display-settings';
import { CalendarMonthGrid } from './calendar-month-grid';
import { type CalendarMonth, firstDayOf, monthOfDate, monthTitle, shiftMonth } from './calendar-month-model';

/** Props of {@link CalendarPopover}. Dates are ISO `YYYY-MM-DD` whatever calendar is shown. */
export interface CalendarPopoverProps {
  /** the field's label: the button reads "Open calendar for <label>" */
  label: string;
  /** `YYYY-MM-DD` or `''` */
  value: string;
  onSelect: (isoDate: string) => void;
  /** defaults to the plant preference (`useCalendarPreference()`) */
  calendar?: CalendarSystem;
  digits?: DigitSystem;
  /** first day of the week (`saturday` …); defaults to the acting plant's week start, else Saturday */
  weekStart?: string | null;
  /** the date shown when `value` is empty (e.g. today on the plant clock) */
  fallbackDate?: string;
  disabled?: boolean;
  /** a 36 px button, for toolbars where every control is h-9 */
  compact?: boolean;
}

/**
 * A calendar button beside a date field: opens a month grid in the plant calendar (Gregorian or Solar
 * Hijri) and digits. Choosing a day (click or Enter) writes it and closes; Esc closes; focus returns to
 * the button.
 */
export function CalendarPopover({ label, value, onSelect, weekStart, fallbackDate, disabled, compact, ...shown }: CalendarPopoverProps) {
  const preference = useCalendarPreference();
  const [open, setOpen] = useState(false);
  const panel = {
    value: value || fallbackDate,
    selected: value,
    calendar: shown.calendar ?? preference.calendar,
    digits: shown.digits ?? preference.digits,
    onSelect: (isoDate: string) => {
      setOpen(false);
      onSelect(isoDate);
    },
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="icon" className={compact ? 'h-9 w-9 shrink-0' : 'h-10 w-10 shrink-0'} aria-label={`Open calendar for ${label}`} disabled={disabled}>
          <UiIcon.datePicker className="h-4 w-4" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-3" onOpenAutoFocus={(event) => event.preventDefault()}>
        {weekStart === undefined ? <PlantWeekPanel {...panel} /> : <CalendarPanel {...panel} weekStart={weekStart} />}
      </PopoverContent>
    </Popover>
  );
}

interface PanelProps {
  /** the date the grid opens on */
  value: string;
  selected: string;
  calendar: CalendarSystem;
  digits: DigitSystem;
  onSelect: (isoDate: string) => void;
}

/** The panel on the acting plant's week start (read only while the calendar is open). */
function PlantWeekPanel(props: PanelProps) {
  const plant = useActingTenant();
  return <CalendarPanel {...props} weekStart={plant.data?.weekStart} />;
}

function CalendarPanel({ value, selected, calendar, digits, weekStart, onSelect }: PanelProps & { weekStart: string | null | undefined }) {
  const [active, setActive] = useState(value);
  const [month, setMonth] = useState<CalendarMonth>(() => monthOfDate(value, calendar));
  const moveActive = (isoDate: string) => {
    setActive(isoDate);
    setMonth(monthOfDate(isoDate, calendar));
  };
  const page = (count: number) => {
    const next = shiftMonth(month, count);
    setMonth(next);
    setActive(firstDayOf(next, calendar));
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Previous month" onClick={() => page(-1)}>
          <UiIcon.previous className="h-4 w-4" aria-hidden />
        </Button>
        <span className="text-sm font-medium" aria-hidden>
          {monthTitle(month, calendar, digits)}
        </span>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Next month" onClick={() => page(1)}>
          <UiIcon.next className="h-4 w-4" aria-hidden />
        </Button>
      </div>
      <CalendarMonthGrid
        month={month}
        calendar={calendar}
        digits={digits}
        weekStart={weekStart}
        selected={selected}
        active={active}
        onActiveChange={moveActive}
        onSelect={onSelect}
      />
    </div>
  );
}
