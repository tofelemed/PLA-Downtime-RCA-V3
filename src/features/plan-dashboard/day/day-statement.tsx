import type { DayStatementView } from '@/api/v2/types/loss-statement';
import { plural } from '@/features/ux-kit/format/plural';
import { LossAccountingStatement } from '../components/loss-accounting-statement';

/**
 * The day's loss accounting statement (Task 13): the server's sum of the day's periods (approved revision
 * when one exists, else the open draft, marked provisional) and how many periods it does not hold yet.
 */
export function DayStatement({ accounting }: { accounting: DayStatementView | undefined }) {
  if (!accounting) return null;
  const left = accounting.incomplete;
  const note = left > 0 ? <p className="text-xs text-muted-foreground" data-testid="day-statement-incomplete">{`${plural(left, 'period', 'periods')} of this day ${left === 1 ? 'is' : 'are'} not in the statement yet (no calculation, target or actuals).`}</p> : null;
  if (!accounting.statement) return note;
  return (
    <div className="space-y-1">
      <LossAccountingStatement statement={accounting.statement} title="Day accounting" testId="day-statement" />
      {note}
    </div>
  );
}
