import { useOeeReport } from '@/api/v2/queries/reports';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { AnalyticsCard } from '../components/analytics-card';
import { OeeTile } from '../components/oee-tile';
import { oeeQuery, type AnalyticsScope, type OeePolicy } from '../model/analytics-scope';
import { findKpi, OEE_METRIC_LABELS } from '../model/display';

const LABELS: Record<OeePolicy, string> = { operational: 'Operational OEE (ISO 22400)', reconciled: 'Reconciled PLA OEE' };
const DENOMINATORS: Record<OeePolicy, string> = { operational: 'over scheduled time', reconciled: 'capacity-ledger good ÷ capacity' };

/** The operational OEE with its availability, performance and quality; the reconciled OEE as one labelled tile (D04). */
export function DashboardOee({ scope, policy }: { scope: AnalyticsScope; policy: OeePolicy }) {
  const env = useEventHubEnv();
  const query = useOeeReport(oeeQuery(scope, 'unit', policy), env.timezone);
  const data = query.data?.data;
  const prefix = policy === 'reconciled' ? 'reconciled_' : '';
  const label = data?.label ?? LABELS[policy];
  const components = policy === 'operational' ? ['availability', 'performance', 'quality'] : [];
  return (
    <AnalyticsCard title={label} testId={`dashboard-oee-${policy}`} query={query} response={query.data}>
      <div className={policy === 'operational' ? 'grid grid-cols-2 gap-2 sm:grid-cols-4' : 'grid grid-cols-1 gap-2'}>
        <OeeTile title="OEE" label={label} view={findKpi(data?.total, `${prefix}oee`)} denominator={DENOMINATORS[policy]} testId={`dashboard-oee-${policy}-tile`} />
        {components.map((component) => (
          <OeeTile key={component} title={OEE_METRIC_LABELS[component]} label={label} view={findKpi(data?.total, component)} denominator="of the same periods" testId={`dashboard-oee-${component}`} />
        ))}
      </div>
    </AnalyticsCard>
  );
}
