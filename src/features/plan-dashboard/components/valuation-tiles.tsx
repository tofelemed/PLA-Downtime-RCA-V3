import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLossValue } from '@/api/v2/queries/period-overview';
import type { LedgerKind } from '@/api/v2/types/period-overview';
import type { ReconciliationView } from '@/api/v2/types/reconciliation';
import { DisplayCurrencyToggle } from '@/features/display-currency/display-currency-toggle';
import { entriesInCurrency } from '@/features/display-currency/money-format';
import { useDisplayCurrency } from '@/features/display-currency/use-display-currency';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { labelOf, VALUATION_STATUS_LABELS } from '@/features/ux-kit/labels';
import { Quantity } from '@/features/ux-kit/quantity';
import { useCalendarPreference } from '@/lib/dates';
import { formatMoney, valuationReasonLabel } from '../model/display';
import { valuationChoiceOf } from '../model/valuation-basis';
import { ValuationBasisNote } from './valuation-basis-note';
import { ValuationBreakdown } from './valuation-breakdown';

/** Approved or provisional figures; an approved revision shown under the current policy view is neither. */
function ValuationStatusBadge({ status, notApprovedView }: { status: 'approved' | 'provisional'; notApprovedView: boolean }) {
  if (notApprovedView) return <Badge variant="outline" data-testid="valuation-status" data-status="not_approved_view">Current policy view (not approved)</Badge>;
  return (
    <Badge variant={status === 'approved' ? 'default' : 'outline'} data-testid="valuation-status" data-status={status}>
      {status === 'approved' ? 'Approved, reconciled value' : 'Provisional value'}
    </Badge>
  );
}

export interface ValuationTilesProps {
  period: ReconciliationView;
  ledger: LedgerKind;
  approvedOnly: boolean;
  /** the period's History & exports section (change proposals) */
  historyHref: string;
}

/**
 * Loss value of the period from the 2.6 valuation (replaces the flat `lossValuePerUnit`): the tile of the
 * user's display currency (USD by default, IRR on request; the server reports both) with its status and
 * reasons — an unapproved policy or a missing FX rate is shown, never a zero; unpriced quantities are listed
 * with their unit. An approved revision opens on the view frozen at its approval (owner, 18 Oct 2026).
 */
export function ValuationTiles({ period, ledger, approvedOnly, historyHref }: ValuationTilesProps) {
  const [wantCurrent, setWantCurrent] = useState(false);
  const choice = valuationChoiceOf(period, wantCurrent);
  const query = { unitIds: [period.unitId], from: period.utcStart, to: period.utcEnd, ledger, approvedOnly, metric: choice.metric };
  const report = useLossValue(query);
  const data = report.data?.data;
  const state = dataStateOf(report);
  const { currency } = useDisplayCurrency();
  const { digits } = useCalendarPreference();
  const tiles = entriesInCurrency(data?.total.currencies ?? [], (c) => c.currency, currency);
  return (
    <section className="space-y-2" data-testid="valuation-tiles">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Loss value{data ? ` · ${data.label}` : ''}</h3>
        <DisplayCurrencyToggle />
      </div>
      {period.approvedValuation && (
        <ValuationBasisNote approved={period.approvedValuation} shown={choice.shown} onShow={(shown) => setWantCurrent(shown === 'current')} historyHref={historyHref} />
      )}
      <DataState state={state} error={report.error}>
        <div className="grid gap-2 sm:grid-cols-2">
          {tiles.map((c) => (
            <Card key={c.currency} data-testid="value-tile" data-currency={c.currency} data-status={c.status}>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm">{c.currency}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p className="text-lg font-semibold">{formatMoney(c, digits)}</p>
                <Badge variant={c.status === 'valued' ? 'default' : 'secondary'}>{labelOf(VALUATION_STATUS_LABELS, c.status)}</Badge>
                {c.reasons.map((r) => (
                  <p key={r} className="text-xs text-warning" data-testid="value-reason" data-reason={r}>
                    {valuationReasonLabel(r)}
                  </p>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
        {data?.total.currencies.length === 0 && <p className="text-sm text-muted-foreground">No valuation for this period (calculated before valuation, or nothing to value).</p>}
        {(data?.total.unvalued ?? []).map((u) => (
          <p key={u.uom ?? '-'} className="text-xs text-muted-foreground">
            Not priced: <Quantity value={u.quantity} uom={u.uom} />
          </p>
        ))}
        {data && <ValuationStatusBadge status={data.valuationStatus} notApprovedView={choice.shown === 'current' && Boolean(period.approvedValuation)} />}
        {report.data?.isProvisional && <p className="text-xs text-muted-foreground">Provisional: includes a revision that is not approved.</p>}
        {data?.view === 'economic_impact' && <ValuationBreakdown query={query} />}
      </DataState>
    </section>
  );
}
