import type { ReactNode } from 'react';
import type { CalendarBasisUnitView, CalendarBasisView } from '@/api/v2/types/reports';
import { Badge } from '@/components/ui/badge';
import { formatOperationalDate, useCalendarPreference } from '@/lib/dates';
import { CALENDAR_BASIS_BADGE } from '../model/kpi-display';

const OMITTED_TEXT: Readonly<Record<NonNullable<CalendarBasisView['omitted']>, string>> = {
  approved_only: 'Units/days without a calculation run are not shown: “Approved only” counts calculated periods only.',
  period_selection: 'Units/days without a calculation run are not shown: product, shift and crew filters apply to calculated periods only.',
  schedule_class: 'Units/days without a calculation run are not shown while a schedule class is chosen.',
};

function UnitDays({ unit }: { unit: CalendarBasisUnitView }) {
  const pref = useCalendarPreference();
  const dates = unit.days.map((day) => formatOperationalDate(day.localDate, pref)).join(', ');
  return (
    <li data-testid="calendar-basis-unit" data-unit-id={unit.unitId}>
      <span className="font-medium">{unit.unitName ?? 'Unit'}</span>: {dates}
      {unit.policy === 'default' && <span className="text-muted-foreground"> (default OEE policy)</span>}
    </li>
  );
}

/**
 * Plan 2.3: the server's calendar-basis figures for units/days without a calculation run, under their own
 * badge and apart from the calculated summary (never added to it). `children` are the tiles of the total.
 */
export function CalendarBasisSection({ calendar, children }: { calendar: CalendarBasisView | undefined; children: ReactNode }) {
  if (!calendar) return null;
  if (calendar.omitted) {
    return <p className="mt-3 text-xs text-muted-foreground" data-testid="calendar-basis-omitted">{OMITTED_TEXT[calendar.omitted]}</p>;
  }
  if (calendar.units.length === 0) return null;
  return (
    <section className="mt-4 space-y-2 rounded-md border border-dashed p-3" data-testid="calendar-basis" aria-label="Calendar basis">
      <Badge variant="outline" data-testid="calendar-basis-badge">{calendar.label || CALENDAR_BASIS_BADGE}</Badge>
      <p className="text-xs text-muted-foreground">
        Computed from the stops over 24 h of calendar time per production day. Shown separately: these figures are not part of the calculated figures above.
      </p>
      <ul className="text-xs">{calendar.units.map((unit) => <UnitDays key={unit.unitId} unit={unit} />)}</ul>
      {children}
    </section>
  );
}
