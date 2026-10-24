import { DateRangeInput } from "@/features/ux-kit/date-inputs";
import { useOperationalDayStart } from "@/features/ux-kit/use-operational-day-start";
import {
  toCalendarDayRange,
  toProductionDayRange,
} from "../model/production-day-range";

export interface ProductionDateRangeProps {
  from: string;
  to: string;
  timeZone: string;
  onChange: (range: { from: string; to: string }) => void;
}

/**
 * "Period dates" of the downtime window in production days (owner decision 2026-10-19, QA L20): one day picked
 * is 06:00–06:00 plant time, and that window reads From 17 Oct, To 17 Oct. Fields as on Reports: typed in the plant
 * date format with the plant-calendar picker, h-9 toolbar items. Hidden until the plant's
 * day start is known, so a date pick is never sent with a guessed boundary.
 */
export function ProductionDateRange({
  from,
  to,
  timeZone,
  onChange,
}: ProductionDateRangeProps) {
  const dayStart = useOperationalDayStart();
  if (dayStart === null) return null;
  // a date fits 7 rem: the row (Units … Revision) stays on one line at 1440 px; `contents` keeps From / To items of the bar
  return (
    <div className="contents [&_input]:w-28" data-testid="downtime-dates">
      <DateRangeInput
        label="Period dates"
        toLabel="To"
        calendarPicker
        textEntry
        toolbar
        value={toCalendarDayRange({ from, to }, timeZone, dayStart)}
        timeZone={timeZone}
        onChange={(range) => {
          const days = toProductionDayRange(range, timeZone, dayStart);
          if (days.from && days.to) onChange({ from: days.from, to: days.to });
        }}
      />
    </div>
  );
}
