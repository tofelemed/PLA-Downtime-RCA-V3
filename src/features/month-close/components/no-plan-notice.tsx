import { Link } from 'react-router-dom';
import type { MonthCloseView, UncoveredDayView } from '@/api/v2/types/month-close';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { plural } from '@/features/ux-kit/format/plural';
import { formatOperationalDate, useCalendarPreference, type CalendarPreference } from '@/lib/dates';

/** Owner decision 2026-10-19 (QA P-0): the words and the way out for a period no approved plan covers. */
export const NO_PLAN_TEXT = 'No approved plan covers this period';

/** "No approved plan covers this period" with a link to Plans for those who can open it. */
export function NoPlanLink({ text = NO_PLAN_TEXT }: { text?: string }) {
  const { canViewAnalysis } = useCapabilities();
  return (
    <span className="text-sm text-muted-foreground" data-testid="no-plan">
      {text}
      {canViewAnalysis && (
        <>
          {' · '}
          <Link to="/planning?tab=plans" className="underline underline-offset-2" onClick={(event) => event.stopPropagation()}>
            Open Plans
          </Link>
        </>
      )}
    </span>
  );
}

function columns(pref: CalendarPreference): DataTableColumn<UncoveredDayView>[] {
  return [
    { id: 'date', header: 'Operational date', cell: (d) => formatOperationalDate(d.localDate, pref), nowrap: true },
    { id: 'unit', header: 'Unit', cell: (d) => <span className="break-words">{d.unitName ?? 'Unit'}</span> },
    { id: 'shifts', header: 'Shifts', align: 'right', cell: (d) => d.shifts },
  ];
}

/**
 * The month's production days that no approved plan covers: information, never a prerequisite. They are
 * left out of every count of the month close until a plan covers them (owner decision 2026-10-19).
 */
export function UncoveredDays({ view }: { view: MonthCloseView }) {
  const pref = useCalendarPreference();
  const count = view.prerequisites.uncoveredDayCount ?? 0;
  const days = view.prerequisites.uncoveredDays ?? [];
  if (count === 0) return null;
  return (
    <div className="space-y-2 rounded-md border border-dashed p-3" role="note" data-testid="uncovered-days">
      <p className="text-sm">
        <span className="font-medium">{plural(count, 'production day has', 'production days have')} no approved plan.</span>{' '}
        Their periods are not counted above and need no approval until a plan covers them. <NoPlanLink text="Create or approve a plan version to include them" />
      </p>
      {days.length > 0 && (
        <DataTable caption="Days without an approved plan" columns={columns(pref)} rows={days} getRowKey={(d) => `${d.unitId}-${d.localDate}`} pager="none" density="compact" maxHeight="16rem" />
      )}
    </div>
  );
}
