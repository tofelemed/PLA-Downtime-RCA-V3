import { Section } from '@/features/ux-kit/page-layout';
import type { AnalyticsScope } from '../model/analytics-scope';
import { QualityTab } from './quality-tab';
import { ReconciliationTab } from './reconciliation-tab';

/** Reconciliation view of PLA: status and overdue periods, with the actuals quality coverage behind a disclosure. */
export function ReconciliationView({ scope }: { scope: AnalyticsScope }) {
  return (
    <div className="space-y-6">
      <ReconciliationTab scope={scope} />
      <Section title="Actuals quality coverage" collapsible defaultOpen={false} id="quality" description="How much of the output figures were measured, estimated or missing.">
        <QualityTab scope={scope} />
      </Section>
    </div>
  );
}
