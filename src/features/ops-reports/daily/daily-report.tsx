import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { DashboardOee } from '@/features/pla-analytics/dashboard/dashboard-oee';
import type { AnalyticsScope } from '@/features/pla-analytics/model/analytics-scope';
import { monthToDateWindow } from '../model/month-to-date';
import { EventStatusCard } from './event-status-card';
import { ProductionTable } from './production-table';
import { TopLossesCards } from './top-losses-card';

function Section({ scope, title, testId }: { scope: AnalyticsScope; title: string; testId: string }) {
  return (
    <section className="space-y-3" data-testid={testId} aria-label={title}>
      <h2 className="text-lg font-semibold">{title}</h2>
      <DashboardOee scope={scope} policy="operational" />
      <ProductionTable scope={scope} title={`Production by product · ${title.toLowerCase()}`} testId={`${testId}-production`} />
    </section>
  );
}

/**
 * Daily production report (R1, morning meeting): the chosen production days and the month to date — OEE
 * with its components, output against plan per product with prime and off-grade — then the largest losses
 * and how far the events are coded. Every figure is a server read of the shown runs.
 */
export function DailyReport({ scope, dayStart }: { scope: AnalyticsScope; dayStart: string }) {
  const env = useEventHubEnv();
  const mtd = monthToDateWindow(scope, dayStart, env.timezone);
  return (
    <div className="space-y-6" data-testid="daily-report">
      <Section scope={scope} title="Chosen days" testId="daily-days" />
      {mtd && <Section scope={{ ...scope, ...mtd, windowLabel: 'Month to date' }} title="Month to date" testId="daily-mtd" />}
      <TopLossesCards scope={scope} />
      <EventStatusCard scope={scope} />
    </div>
  );
}
