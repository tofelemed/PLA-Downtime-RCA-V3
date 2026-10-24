import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';

const STATES_INFO =
  'Physical, coding and investigation state of each event. The shift accounting is shown only when it has moved past draft (in review or approved); draft is the default and is not repeated on every row.';

/** Header of the event list's States column, with what the chips mean (the accounting draft state is not shown). */
export function StatesHeader() {
  return (
    <span className="inline-flex items-center gap-1">
      States
      <KpiInfo label="States" text={STATES_INFO} />
    </span>
  );
}
