import { Link } from 'react-router-dom';
import { useProductionDay } from '@/api/v2/queries/production-days';
import type { ProductionEventView } from '@/api/v2/types/events';
import { LossAccountingStatement } from '@/features/plan-dashboard/components/loss-accounting-statement';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { accountingHrefOf, NO_ACCOUNTING_PERIOD } from '../model/accounting-link';

/** The link to the event's period row on the Accounting statement page (none without a period). */
function PeriodStatementLink({ href }: { href: string | null }) {
  if (!href) return null;
  return (
    <Link to={href} className="text-sm font-medium text-primary hover:underline" data-testid="day-accounting-link">
      Open the period in the Accounting statement
    </Link>
  );
}

/** The day's statement, as the server sums it, or the empty note while the day has no calculated period. */
function DayStatement({ unitId, localDate, href }: { unitId: string; localDate: string; href: string | null }) {
  const day = useProductionDay(unitId, localDate);
  const statement = day.data?.accounting?.statement ?? null;
  const isEmpty = day.data !== undefined && statement === null;
  return (
    <DataState state={dataStateOf(day, { isEmpty })} error={day.error} onRetry={() => void day.refetch()} detail="The day has no calculated period yet.">
      {statement && <LossAccountingStatement statement={statement} title="Day accounting" actions={<PeriodStatementLink href={href} />} testId="day-accounting-statement" />}
    </DataState>
  );
}

/**
 * Task 13 "Day accounting": the statement of the production day the event's period belongs to (the server
 * sums the day's periods), with a link to that period's row on the Accounting statement page.
 */
export function DayAccountingCard({ event }: { event: ProductionEventView }) {
  const period = event.accountingPeriod ?? null;
  if (!period) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="day-accounting-none">
        {NO_ACCOUNTING_PERIOD}.
      </p>
    );
  }
  return (
    <div data-testid="day-accounting">
      <DayStatement unitId={event.unitId} localDate={period.localDate} href={accountingHrefOf(event)} />
    </div>
  );
}
