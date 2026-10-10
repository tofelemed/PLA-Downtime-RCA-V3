import { useReport } from '@/api/v2/queries/reports';
import type { LossValueReportView } from '@/api/v2/types/period-overview';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { ReportCard } from '@/features/downtime-analysis/components/report-card';
import { formatMoney } from '@/features/plan-dashboard/model/display';
import { lossValueQuery, type AnalyticsScope } from '../model/analytics-scope';

/**
 * Loss value per unit (Reports tab, 2.6): the contribution-margin view of the chosen ledger per reporting
 * currency (IRR and USD, D08); a missing amount says why (policy not approved, FX rate missing), never 0.
 */
export function LossValueCard({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const query = useReport<LossValueReportView>('loss-value', lossValueQuery(scope), env.timezone);
  const data = query.data?.data;
  const currencies = data?.total.currencies.map((c) => c.currency) ?? [];
  return (
    <ReportCard title={`Loss value · ${data?.label ?? 'contribution margin'} · ${scope.ledger} ledger`} testId="report-loss-value" query={query} response={query.data} isEmpty={data?.groups.length === 0} emptyText="Nothing valued in these periods." note={data ? `Basis: ${data.basis}.` : undefined}>
      {data && (
        <Table aria-label="Loss value by unit">
          <TableHeader>
            <TableRow>
              <TableHead>Unit</TableHead>
              {currencies.map((c) => (
                <TableHead key={c} className="text-right">
                  {c}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...data.groups, data.total].map((group) => (
              <TableRow key={group.key} data-testid="report-value-row" data-key={group.key}>
                <TableCell>{group.key === 'total' ? 'Total' : env.unitName(group.key)}</TableCell>
                {currencies.map((c) => {
                  const value = group.currencies.find((entry) => entry.currency === c);
                  return (
                    <TableCell key={c} className="text-right" data-status={value?.status ?? ''}>
                      {value ? formatMoney(value) : '—'}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </ReportCard>
  );
}
