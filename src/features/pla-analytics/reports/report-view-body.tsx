import { OPS_VIEWS, type OpsReportProps } from '@/features/ops-reports/ops-report-registry';
import { OpsReportView } from '@/features/ops-reports/ops-report-views';
import { ReconciliationTab } from '../tabs/reconciliation-tab';
import { EconomicBreakdownCard } from './economic-breakdown-card';
import { LossValueCard } from './loss-value-card';
import { DowntimeReasonCard, OeeByDay } from './production-report';
import { ReportExports } from './report-exports';

/** The shown report (`?view=`): only its cards mount, so only its queries run. */
export function ReportViewBody({ view, scope, dayStart }: OpsReportProps & { view: string }) {
  if (OPS_VIEWS.some((entry) => entry.key === view)) return <OpsReportView viewKey={view} scope={scope} dayStart={dayStart} />;
  if (view === 'reconciliation') return <ReconciliationTab scope={scope} />;
  if (view === 'exports') return <ReportExports scope={scope} />;
  if (view === 'value') {
    return (
      <div className="space-y-4">
        <LossValueCard scope={scope} />
        <EconomicBreakdownCard scope={scope} />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <OeeByDay scope={scope} />
      <DowntimeReasonCard scope={scope} />
    </div>
  );
}
