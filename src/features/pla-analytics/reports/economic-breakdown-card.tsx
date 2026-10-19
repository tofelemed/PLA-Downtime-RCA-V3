import { useReport } from '@/api/v2/queries/reports';
import type { LossValueReportView } from '@/api/v2/types/period-overview';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { LEDGER_LABELS } from '@/features/ux-kit/labels';
import { EconomicBreakdownTable } from '@/features/valuation-breakdown/economic-breakdown-table';
import { AnalyticsCard } from '../components/analytics-card';
import { lossValueComponentsQuery, type AnalyticsScope } from '../model/analytics-scope';
import { revisionSelectionLabel } from '../model/links';

/**
 * VA-04 on Reports: the economic view of the scope by component (lost contribution, scrap cost, salvage,
 * disposal, downgrade difference, rework cost, yield loss, displaced output) as the server summed it, in the
 * display currency (USD by default, IRR with the header's currency choice — one toggle per screen).
 */
export function EconomicBreakdownCard({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const query = useReport<LossValueReportView>('loss-value', lossValueComponentsQuery(scope), env.timezone);
  const components = query.data?.data.components ?? [];
  return (
    <AnalyticsCard
      title={`Economic impact by component · ${LEDGER_LABELS[scope.ledger].toLowerCase()}`}
      testId="report-economic-breakdown"
      query={query}
      response={query.data}
      approvedOnly={scope.approvedOnly}
      isEmpty={components.length === 0}
      emptyText="No economic value in these periods (the valuation policy may have no economic view)."
      note={`${revisionSelectionLabel(scope.approvedOnly)}. Values from before the breakdown are listed as not broken down.`}
    >
      <EconomicBreakdownTable components={components} caption="Economic impact by component" />
    </AnalyticsCard>
  );
}
