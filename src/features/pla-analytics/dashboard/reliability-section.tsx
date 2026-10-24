import type { AnalyticsScope } from '../model/analytics-scope';
import type { DashboardNode } from '../model/dashboard-scope';
import { KpiSection } from './kpi-section';
import { MtbfTrendChart } from './mtbf-trend-chart';
import { RcaTiles } from './rca-tiles';
import { TopAssetsTable } from './top-assets-table';

/** Asset reliability: investigation and action counts, MTBF and MTTR by month for the selected node, and the most stopped assets. */
export function ReliabilitySection({ scope, node }: { scope: AnalyticsScope; node: DashboardNode }) {
  return (
    <KpiSection title="Asset reliability">
      <div className="space-y-4" data-testid="dashboard-reliability">
        <RcaTiles />
        <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
          <MtbfTrendChart scope={scope} node={node} />
          <TopAssetsTable scope={scope} />
        </div>
      </div>
    </KpiSection>
  );
}
