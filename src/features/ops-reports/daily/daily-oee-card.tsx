import { useOeeReport } from '@/api/v2/queries/reports';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { AnalyticsCard } from '@/features/pla-analytics/components/analytics-card';
import { OeeTiles } from '@/features/pla-analytics/dashboard/oee-section';
import { OPERATIONAL_LABEL } from '@/features/pla-analytics/dashboard/oee-tile-model';
import { oeeQuery, type AnalyticsScope } from '@/features/pla-analytics/model/analytics-scope';
import { reportText } from '@/features/pla-analytics/model/report-text';

/**
 * The operational OEE of the report's days with its availability, performance and quality, in a card
 * titled with the server's policy label as the Reports page says it, "OEE" (the reconciled OEE is not part of R1).
 */
export function DailyOeeCard({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const query = useOeeReport(oeeQuery(scope, 'unit', 'operational'), env.timezone);
  return (
    <AnalyticsCard title={reportText(query.data?.data.label ?? OPERATIONAL_LABEL)} testId="dashboard-oee-operational" query={query} response={query.data}>
      <OeeTiles scope={scope} operationalOnly />
    </AnalyticsCard>
  );
}
