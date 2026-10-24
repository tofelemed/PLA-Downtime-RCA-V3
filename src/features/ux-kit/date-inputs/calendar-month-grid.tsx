import { type KeyboardEvent, useEffect, useRef } from 'react';
import { type CalendarSystem, type DigitSystem, toDigits } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { type CalendarDay, type CalendarMonth, monthTitle, monthWeeks, moveDay, weekdayLabels } from './calendar-month-model';
import { dateToText } from './date-input-model';

export interface CalendarMonthGridProps {
  month: CalendarMonth;
  calendar: CalendarSystem;
  digits: DigitSystem;
  weekStart: string | null | undefined;
  /** the chosen ISO date, or `''` */
  selected: string;
  /** the ISO date that holds keyboard focus */
  active: string;
  onActiveChange: (isoDate: string) => void;
  onSelect: (isoDate: string) => void;
}

/**
 * One month as an ARIA grid: weekday headers from the plant week start, day buttons in the plant digits,
 * a roving focus on the active day (arrows move it, Enter chooses it).
 */
export function CalendarMonthGrid({ month, calendar, digits, weekStart, selected, active, onActiveChange, onSelect }: CalendarMonthGridProps) {
  const gridRef = useRef<HTMLTableElement>(null);
  // focus follows the active day on open and on arrow keys, not when the month buttons page
  const focusActive = useRef(true);
  useEffect(() => {
    if (!focusActive.current) return;
    focusActive.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${active}"]`)?.focus();
  }, [active]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onSelect(active);
      return;
    }
    const next = moveDay(active, event.key);
    if (!next) return;
    event.preventDefault();
    focusActive.current = true;
    onActiveChange(next);
  };

  const dayCell = (day: CalendarDay) => (
    <button
      type="button"
      data-date={day.iso}
      aria-label={dateToText(day.iso, calendar, digits)}
      tabIndex={day.iso === active ? 0 : -1}
      onClick={() => onSelect(day.iso)}
      onKeyDown={onKeyDown}
      className={cn(
        'h-8 w-8 rounded-md text-sm tabular-nums hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        day.iso === selected && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
      )}
    >
      {toDigits(String(day.day), digits)}
    </button>
  );

  return (
    <table ref={gridRef} role="grid" aria-label={monthTitle(month, calendar, digits)} className="w-full border-collapse">
      <thead>
        <tr>
          {weekdayLabels(weekStart).map((name) => (
            <th key={name} role="columnheader" scope="col" className="h-8 text-xs font-normal text-muted-foreground">
              {name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {monthWeeks(month, calendar, weekStart).map((week, row) => (
          <tr key={row}>
            {week.map((day, col) => (
              <td key={col} role="gridcell" aria-selected={day ? day.iso === selected : undefined} className="p-0 text-center">
                {day && dayCell(day)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
