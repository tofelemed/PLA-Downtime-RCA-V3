import { useOeeReport } from '@/api/v2/queries/reports';
import { PageHeader } from '@/features/ux-kit/page-layout';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { oeeQuery, type AnalyticsScope } from '../model/analytics-scope';

/**
 * Reports header: the h1 only (redesign 24 Oct 2026 — no description, scope line, revision badge or
 * snapshot status; the top bar shows the dates, units and revision). A hidden marker keeps the shown
 * snapshot's units and calculation runs readable for the end-to-end tests (T24).
 */
export function ReportsHeader({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const query = useOeeReport(oeeQuery(scope, 'day', 'operational'), env.timezone);
  const runIds = query.data?.data.calculationRunIds ?? [];
  return (
    <>
      <PageHeader title="Reports" />
      <span hidden data-testid="report-snapshot" data-run-ids={[...runIds].sort().join(',')} data-unit-ids={scope.unitIds.join(',')} />
    </>
  );
}
