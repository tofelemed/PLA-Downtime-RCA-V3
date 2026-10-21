import type { MonthCloseView } from '@/api/v2/types/month-close';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { formatOperationalDate, useCalendarPreference } from '@/lib/dates';

const LISTED = 10;

function MissingPeriods({ view }: { view: MonthCloseView }) {
  const { missingPeriodCount: count, missingPeriods: list } = view.prerequisites;
  const pref = useCalendarPreference();
  if (count === 0) return null;
  const shown = list.slice(0, LISTED);
  const more = count - shown.length;
  return (
    <div className="text-sm" data-testid="close-missing-periods">
      <p>
        {count} expected {count === 1 ? 'period does' : 'periods do'} not exist yet: each scheduled shift needs its period approved before the close.
      </p>
      <ul className="list-disc pl-5 text-xs text-muted-foreground">
        {shown.map((m) => (
          <li key={`${m.unitId}-${m.utcStart}`}>
            {m.unitName ?? 'Unit'} · {formatOperationalDate(m.localDate, pref)} · shift {m.shiftName}
          </li>
        ))}
        {more > 0 && <li>and {more} more</li>}
      </ul>
    </div>
  );
}

/**
 * Why "Close quantities…" may still be disabled although the counts look settled (Marun regression G1):
 * the month has not ended yet in plant time, or scheduled shifts have no period yet. Server facts only.
 */
export function CloseMonthEnd({ view }: { view: MonthCloseView }) {
  const { monthEnded, monthEndsAt } = view.prerequisites;
  const tz = view.deadlines.timezone;
  return (
    <div className="space-y-1" data-testid="close-month-end">
      <p className="text-sm" data-testid="close-month-end-status" data-ended={monthEnded}>
        {monthEnded ? 'Month ended ' : 'Month ends '}
        <PlantTime iso={monthEndsAt} tz={tz} withDate />
        {monthEnded ? '.' : ' — not ended yet; the quantities can be closed after that.'}
      </p>
      <MissingPeriods view={view} />
    </div>
  );
}
