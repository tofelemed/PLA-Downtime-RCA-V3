import { useOeeReport } from '@/api/v2/queries/reports';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { AnalyticsCard } from '../components/analytics-card';
import { OeeGroupTable } from '../components/oee-group-table';
import { OeeTile } from '../components/oee-tile';
import { oeeQuery, type AnalyticsScope, type OeePolicy } from '../model/analytics-scope';
import { findKpi, OEE_METRIC_LABELS } from '../model/display';

const POLICIES: ReadonlyArray<{ policy: OeePolicy; prefix: string; denominator: string }> = [
  { policy: 'operational', prefix: '', denominator: 'good output at the sustained rate (as time) ÷ scheduled time' },
  { policy: 'reconciled', prefix: 'reconciled_', denominator: 'capacity-ledger good ÷ capacity (only when the capacity ledger has nothing unaccounted)' },
];

const COMPONENT_NOTES: Readonly<Record<string, string>> = {
  availability: 'run time ÷ scheduled time',
  performance: 'output at the sustained rate ÷ run time',
  quality: 'good ÷ total output',
};

/**
 * OEE (KPI03 / KPI04, D04): operational OEE (ISO 22400) and the labelled reconciled PLA OEE side by side,
 * never mixed — each with its policy label and denominator, per unit (20 per page) and for the scope; a
 * missing value reads "Not available: <reason>" (T41).
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
    <AnalyticsCard title={label} testId={`pla-oee-${policy}`} query={query} response={query.data}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {['oee', 'availability', 'performance', 'quality'].map((component) => (
          <OeeTile
            key={component}
            title={OEE_METRIC_LABELS[component]}
            label={label}
            view={findKpi(data?.total, `${prefix}${component}`)}
            denominator={component === 'oee' ? denominator : policy === 'operational' ? COMPONENT_NOTES[component] : 'capacity ledger'}
            testId={`oee-${policy}-${component}`}
          />
        ))}
      </div>
      {data && <OeeGroupTable report={data} groupTitle="Unit" labelOf={(key) => env.unitName(key)} testId={`oee-${policy}-units`} />}
    </AnalyticsCard>
  );
}
