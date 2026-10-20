import { scopeBase, type AnalyticsScope } from '@/features/pla-analytics/model/analytics-scope';
import { LossBreakdownCards } from '../components/loss-breakdown-cards';
import { ProductionTable } from '../daily/production-table';
import { DispositionsCard } from './dispositions-card';
import { PrimeYieldTrend } from './prime-yield-trend';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { ReportExportBar } from '../components/report-export-bar';

/**
 * Quality and off-grade report (R4, quality approver, plant manager): output per product split into prime,
 * wide spec and off-grade, the quality loss by class (downgrade, transition off-grade, scrap, rework) in
 * quantity and value, the prime-yield trend and the lot dispositions still waiting for a decision.
 */
export function QualityReport({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  return (
    <div className="space-y-4" data-testid="quality-report">
      <ReportExportBar kind="quality" query={scopeBase(scope)} timezone={env.timezone} />
      <ProductionTable scope={scope} title="Output by product" testId="quality-production" />
      <LossBreakdownCards scope={scope} groupBy="qualityClass" kinds={['quality']} title="Quality loss by class" testId="quality-classes" />
      <PrimeYieldTrend scope={scope} />
      <DispositionsCard scope={scope} />
    </div>
  );
}
