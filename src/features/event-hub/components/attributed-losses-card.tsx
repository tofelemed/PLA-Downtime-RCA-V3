import { useEventAttributedLosses } from '@/api/v2/queries/production-events';
import type { AttributedPeriodView } from '@/api/v2/types/events';
import { entriesInCurrency } from '@/features/display-currency/money-format';
import { useDisplayCurrency } from '@/features/display-currency/use-display-currency';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { labelOf, LOSS_KIND_LABELS } from '@/features/ux-kit/labels';
import { valueBasisLabel } from '@/features/ux-kit/labels/value-basis';
import { Quantity } from '@/features/ux-kit/quantity';
import { StatusBadge } from '@/features/ux-kit/status-badge';
import { useCalendarPreference } from '@/lib/dates';
import { AttributedValueText } from './attributed-value-text';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { periodLabel } from '../model/period-label';
import { PeriodLink } from './period-link';

/** Approved = the published revision's lines (success); provisional = an open revision's proposals (warning, §5.8). */
function PeriodStatus({ status }: { status: AttributedPeriodView['status'] }) {
  return status === 'approved' ? (
    <StatusBadge tone="success" data-testid="attributed-status">Approved</StatusBadge>
  ) : (
    <StatusBadge tone="warning" data-testid="attributed-status">Provisional</StatusBadge>
  );
}

function AttributedPeriodRow({ item }: { item: AttributedPeriodView }) {
  const preference = useCalendarPreference();
  const { currency } = useDisplayCurrency();
  const values = entriesInCurrency(item.values ?? [], (value) => value.currency, currency);
  // owner 19 Oct 2026 (QA audit): no money for operators
  const { canViewMoney } = useCapabilities();
  return (
    <li className="space-y-1 border-b pb-2 text-sm last:border-b-0" data-testid="attributed-period" data-period-id={item.periodId}>
      <div className="flex flex-wrap items-center gap-2">
        <PeriodLink periodId={item.periodId} planId={item.planId} approved={item.status === 'approved'} testId="attributed-period-link">
          {periodLabel(item.localDate, item.shiftName, preference)}
        </PeriodLink>
        <PeriodStatus status={item.status} />
        <span className="text-xs text-muted-foreground">revision {item.revision}</span>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-0.5" aria-label="Lost quantities">
        {item.quantities.map((row) => (
          <li key={`${row.kind}:${row.uom ?? '-'}`} data-testid="attributed-quantity">
            <span className="text-muted-foreground">{labelOf(LOSS_KIND_LABELS, row.kind)}: </span>
            <Quantity value={row.quantity} uom={row.uom} />
          </li>
        ))}
      </ul>
      {!canViewMoney ? null : values.length > 0 ? (
        <ul aria-label="Value">
          {values.map((value) => (
            <li key={value.currency}>
              <AttributedValueText value={value} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground" data-testid="attributed-no-value">No value stated for this period.</p>
      )}
    </li>
  );
}

/**
 * G-2(b): the loss the event carries in each period it touched, from the stored plan-ledger lines
 * (approved or provisional, as the server labels them): quantities per kind and unit, the value in the
 * display currency (USD by default, IRR on the toggle). Rows are never summed in the browser.
 */
export function AttributedLossesCard({ eventId }: { eventId: string }) {
  const query = useEventAttributedLosses(eventId);
  const data = query.data;
  // QA re-test N5 / N3: the value basis is money context, shown only with the money capability
  const { canViewMoney } = useCapabilities();
  const state = dataStateOf(query, { isEmpty: data !== undefined && data.items.length === 0 });
  return (
    <div className="space-y-2" data-testid="attributed-losses">
      <DataState state={state} error={query.error} onRetry={() => void query.refetch()} detail={state === 'empty' ? 'No loss attributed to this event yet.' : undefined}>
        {data && (
          <>
            <ul className="space-y-2">
              {data.items.map((item) => (
                <AttributedPeriodRow key={`${item.periodId}:${item.revisionId}`} item={item} />
              ))}
            </ul>
            {canViewMoney && data.valuationView && (
              <p className="text-xs text-muted-foreground" data-testid="attributed-valuation-view">
                {valueBasisLabel(data.valuationView)}
              </p>
            )}
            {data.truncated && (
              <p className="text-xs text-warning" data-testid="attributed-truncated">
                Only the earliest periods are listed (server limit); this event touched more.
              </p>
            )}
          </>
        )}
      </DataState>
    </div>
  );
}
