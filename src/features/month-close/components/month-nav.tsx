import { Button } from '@/components/ui/button';
import type { MonthCloseView } from '@/api/v2/types/month-close';
import { formatOperationalDate, useCalendarPreference } from '@/lib/dates';

/** Month key, its dates in the plant calendar, and the previous / next month (keys from the server). */
export function MonthNav({ view, onSelect }: { view: MonthCloseView; onSelect: (month: string) => void }) {
  const pref = useCalendarPreference();
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="month-nav">
      <Button variant="outline" size="sm" data-testid="month-previous" onClick={() => onSelect(view.previousMonthKey)}>
        ← {view.previousMonthKey}
      </Button>
      <span className="text-sm font-medium" data-testid="month-label">
        {view.monthKey} · {formatOperationalDate(view.firstDate, pref)} – {formatOperationalDate(view.lastDate, pref)}
        {view.calendar === 'persian' ? ' (Solar Hijri month)' : ''}
      </span>
      <Button variant="outline" size="sm" data-testid="month-next" onClick={() => onSelect(view.nextMonthKey)}>
        {view.nextMonthKey} →
      </Button>
    </div>
  );
}
