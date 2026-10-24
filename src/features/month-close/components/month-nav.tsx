import { Button } from '@/components/ui/button';
import type { MonthCloseView } from '@/api/v2/types/month-close';
import { formatOperationalDate, useCalendarPreference } from '@/lib/dates';
import { monthLabelOf } from '../model/month-label';

/** The month by name, its dates in the plant calendar, and the previous / next month (keys from the server). */
export function MonthNav({ view, onSelect }: { view: MonthCloseView; onSelect: (month: string) => void }) {
  const pref = useCalendarPreference();
  const label = (monthKey: string) => monthLabelOf(monthKey, view.calendar, pref.digits);
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="month-nav">
      <Button variant="outline" size="sm" data-testid="month-previous" onClick={() => onSelect(view.previousMonthKey)}>
        ← {label(view.previousMonthKey)}
      </Button>
      <span className="text-sm font-medium" data-testid="month-label" data-month={view.monthKey}>
        {label(view.monthKey)} · {formatOperationalDate(view.firstDate, pref)} – {formatOperationalDate(view.lastDate, pref)}
      </span>
      <Button variant="outline" size="sm" data-testid="month-next" onClick={() => onSelect(view.nextMonthKey)}>
        {label(view.nextMonthKey)} →
      </Button>
    </div>
  );
}
