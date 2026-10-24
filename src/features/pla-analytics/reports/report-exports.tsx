import { useId } from 'react';
import { useOeeReport } from '@/api/v2/queries/reports';
import { DisabledReason } from '@/features/ux-kit/disabled-reason';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { ReportCard } from '../components/report-card';
import { ScopeExport } from '../components/scope-export';
import { exportBlockedReason, exportRequestOf, oeeQuery, type AnalyticsScope } from '../model/analytics-scope';
import { REVISION_OPTIONS } from './revision-options';

const EXPORTS = [
  { reportType: 'period_summary', label: 'Period summary', testId: 'export-period-summary' },
  { reportType: 'loss_lines', label: 'Loss lines', testId: 'export-loss-lines' },
] as const;

/** The Exports report: period summary and loss lines as CSV / PDF, approved content only. */
export function ReportExports({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const query = useOeeReport(oeeQuery(scope, 'day', 'operational'), env.timezone);
  const provisional = query.data?.isProvisional ?? true;
  const reason = exportBlockedReason(scope, provisional, REVISION_OPTIONS.approved);
  const reasonId = useId();
  return (
    <ReportCard title="Period summary and loss lines" testId="report-exports">
      <DisabledReason id={reasonId} reason={reason} />
      {EXPORTS.map((entry) => (
        <div key={entry.reportType} className="flex flex-wrap gap-4">
          {(['csv', 'pdf'] as const).map((format) => (
            <ScopeExport
              key={format}
              request={exportRequestOf(scope, entry.reportType, provisional)}
              disabledReason={reason}
              reasonShownAt={reasonId}
              label={entry.label}
              format={format}
              timezone={env.timezone}
              testId={format === 'csv' ? entry.testId : `${entry.testId}-pdf`}
            />
          ))}
        </div>
      ))}
    </ReportCard>
  );
}
