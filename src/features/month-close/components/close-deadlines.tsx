import type { MonthCloseState, MonthCloseView } from '@/api/v2/types/month-close';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { StatusBadge } from '@/features/ux-kit/status-badge';
import type { StatusTone } from '@/features/ux-kit/status-tone';
import { formatOperationalDate, useCalendarPreference } from '@/lib/dates';
import { CLOSE_STATE_LABELS, weekendText } from '../model/close-labels';
import { CloseCard } from './close-card';

const CLOSE_STATE_TONES: Readonly<Record<MonthCloseState, StatusTone>> = {
  open: 'neutral',
  quantities_closed: 'info',
  finance_signed_off: 'info',
  locked: 'success',
};

function Deadline({ label, date, at, overdue, timezone, testId }: { label: string; date: string; at: string; overdue: boolean; timezone: string; testId: string }) {
  const pref = useCalendarPreference();
  return (
    <div className="rounded-md border p-3" data-testid={testId} data-overdue={overdue}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">
        {formatOperationalDate(date, pref)} {overdue && <StatusBadge tone="danger">Overdue</StatusBadge>}
      </p>
      <p className="text-xs text-muted-foreground">
        until <PlantTime iso={at} tz={timezone} withDate withZone={false} />
      </p>
    </div>
  );
}

/** State and working-day deadlines of the month, as the server computed them from the plant calendar. */
export function CloseDeadlines({ view }: { view: MonthCloseView }) {
  const { deadlines, policy } = view;
  const pref = useCalendarPreference();
  return (
    <CloseCard
      title="Status and deadlines"
      info={`Working days skip ${weekendText(policy.weekendDays)} and the plant's holidays (policy version ${policy.version}).`}
    >
      <div className="space-y-3">
        <p>
          <StatusBadge tone={CLOSE_STATE_TONES[view.state]} data-testid="close-state" data-state={view.state}>
            {CLOSE_STATE_LABELS[view.state]}
          </StatusBadge>
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Deadline
            label={`Quantities closed by working day ${policy.quantitiesCloseWorkingDay}`}
            date={deadlines.quantitiesDue}
            at={deadlines.quantitiesDueAt}
            overdue={deadlines.quantitiesOverdue}
            timezone={deadlines.timezone}
            testId="deadline-quantities"
          />
          <Deadline
            label={`Finance sign-off by working day ${policy.financeSignOffWorkingDay}`}
            date={deadlines.financeDue}
            at={deadlines.financeDueAt}
            overdue={deadlines.financeOverdue}
            timezone={deadlines.timezone}
            testId="deadline-finance"
          />
        </div>
        {deadlines.holidays.length > 0 && (
          <p className="text-xs text-muted-foreground">Holidays counted: {deadlines.holidays.map((d) => formatOperationalDate(d, pref)).join(', ')}</p>
        )}
      </div>
    </CloseCard>
  );
}
