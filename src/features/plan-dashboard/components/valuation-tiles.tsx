import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLossValue } from '@/api/v2/queries/period-overview';
import type { LedgerKind } from '@/api/v2/types/period-overview';
import type { ReconciliationView } from '@/api/v2/types/reconciliation';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { Quantity } from '@/features/ux-kit/quantity';
import { formatMoney, valuationReasonLabel } from '../model/display';

export interface ValuationTilesProps {
  period: ReconciliationView;
  ledger: LedgerKind;
  approvedOnly: boolean;
}

/**
 * Loss value of the period from the 2.6 valuation (replaces the flat `lossValuePerUnit`): one tile per
 * reporting currency (IRR and USD, D08) with its status and reasons — an unapproved policy or a missing FX
 * rate is shown, never a zero; unpriced quantities are listed with their unit.
 */
export function ValuationTiles({ period, ledger, approvedOnly }: ValuationTilesProps) {
  const report = useLossValue({ unitIds: [period.unitId], from: period.utcStart, to: period.utcEnd, ledger, approvedOnly });
  const data = report.data?.data;
  const state = dataStateOf(report);
  return (
    <section className="space-y-2" data-testid="valuation-tiles">
      <h3 className="text-sm font-medium">Loss value{data ? ` · ${data.label}` : ''}</h3>
      <DataState state={state} error={report.error}>
        <div className="grid gap-2 sm:grid-cols-2">
          {(data?.total.currencies ?? []).map((c) => (
            <Card key={c.currency} data-testid="value-tile" data-currency={c.currency} data-status={c.status}>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm">{c.currency}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p className="text-lg font-semibold">{formatMoney(c)}</p>
                <Badge variant={c.status === 'valued' ? 'default' : 'secondary'}>{c.status}</Badge>
                {c.reasons.map((r) => (
                  <p key={r} className="text-xs text-amber-700" data-testid="value-reason" data-reason={r}>
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
        {report.data?.isProvisional && <p className="text-xs text-muted-foreground">Provisional: includes a revision that is not approved.</p>}
      </DataState>
    </section>
  );
}
