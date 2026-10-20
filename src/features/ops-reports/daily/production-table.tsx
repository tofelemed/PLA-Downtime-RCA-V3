import { useProductionByProduct } from '@/api/v2/queries/ops-reports';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { AnalyticsCard } from '@/features/pla-analytics/components/analytics-card';
import { scopeBase, type AnalyticsScope } from '@/features/pla-analytics/model/analytics-scope';
import { ProductionRows } from './production-rows';

/**
 * Output per product (R1): plan, actual and attainment, prime, wide spec and off-grade beside the capacity —
 * the server's sums of the shown runs; a product with incomplete actuals is said under the table.
 */
export function ProductionTable({ scope, title, testId }: { scope: AnalyticsScope; title: string; testId: string }) {
  const env = useEventHubEnv();
  const query = useProductionByProduct({ ...scopeBase(scope), groupBy: 'total' }, env.timezone);
  const rows = query.data?.data.rows ?? [];
  return (
    <AnalyticsCard title={title} testId={testId} query={query} response={query.data} approvedOnly={scope.approvedOnly} isEmpty={query.data !== undefined && rows.length === 0} emptyText="No production periods start on these dates.">
      <ProductionRows rows={rows} caption={title} />
    </AnalyticsCard>
  );
}
