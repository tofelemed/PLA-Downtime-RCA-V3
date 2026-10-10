import { useOeeReport } from '@/api/v2/queries/reports';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { ReportCard } from '@/features/downtime-analysis/components/report-card';
import { oeeQuery, type AnalyticsScope, type OeePolicy } from '../model/analytics-scope';
import { findKpi } from '../model/display';
import { OeeGroupTable } from '../components/oee-group-table';
import { OeeTile } from '../components/oee-tile';

const POLICIES: ReadonlyArray<{ policy: OeePolicy; prefix: string; denominator: string }> = [
  { policy: 'operational', prefix: '', denominator: 'Σ good output at the sustained rate (as time) ÷ Σ scheduled time' },
  { policy: 'reconciled', prefix: 'reconciled_', denominator: 'capacity-ledger good ÷ capacity (only when the capacity residual closes)' },
];

/**
 * OEE (KPI03 / KPI04, D04): operational OEE (ISO 22400) and the labelled reconciled PLA OEE side by side,
 * never mixed — each with its policy label and denominator, per unit and for the scope; a missing value
 * reads "Not available: <reason>" (T41).
 */
export function OeeTab({ scope }: { scope: AnalyticsScope }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {POLICIES.map((entry) => (
        <OeePolicyCard key={entry.policy} scope={scope} {...entry} />
      ))}
    </div>
  );
}

function OeePolicyCard({ scope, policy, prefix, denominator }: { scope: AnalyticsScope; policy: OeePolicy; prefix: string; denominator: string }) {
  const env = useEventHubEnv();
  const query = useOeeReport(oeeQuery(scope, 'unit', policy), env.timezone);
  const data = query.data?.data;
  const label = data?.label ?? (policy === 'operational' ? 'Operational OEE (ISO 22400)' : 'Reconciled PLA OEE');
  return (
    <ReportCard title={label} testId={`pla-oee-${policy}`} query={query} response={query.data}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {['oee', 'availability', 'performance', 'quality'].map((component) => (
          <OeeTile
            key={component}
            title={component === 'oee' ? 'OEE' : component.charAt(0).toUpperCase() + component.slice(1)}
            label={label}
            view={findKpi(data?.total, `${prefix}${component}`)}
            denominator={component === 'oee' ? denominator : 'server terms'}
            testId={`oee-${policy}-${component}`}
          />
        ))}
      </div>
      {data && <OeeGroupTable report={data} groupTitle="Unit" labelOf={(key) => env.unitName(key)} testId={`oee-${policy}-units`} />}
    </ReportCard>
  );
}
