import { useMonthClose } from '@/api/v2/queries/month-close';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { OeeTiles } from '@/features/pla-analytics/dashboard/oee-section';
import { scopeBase, type AnalyticsScope } from '@/features/pla-analytics/model/analytics-scope';
import { ReportExportBar } from '../components/report-export-bar';
import { monthToDateWindow } from '../model/month-to-date';
import { EventStatusCard } from './event-status-card';
import { ProductionTable } from './production-table';
import { LossBreakdownCards } from '../components/loss-breakdown-cards';

function Section({ scope, title, testId }: { scope: AnalyticsScope; title: string; testId: string }) {
  return (
    <section className="space-y-3" data-testid={testId} aria-label={title}>
      <h2 className="text-lg font-semibold">{title}</h2>
      <OeeTiles scope={scope} />
      <ProductionTable scope={scope} title={`Production by product · ${title.toLowerCase()}`} testId={`${testId}-production`} />
    </section>
  );
}

/**
 * Daily production report (R1, morning meeting): the chosen production days and the financial month to
 * date — OEE with its components, output against plan per product with prime and off-grade — then the
 * largest losses and how far the events are coded. Every figure is a server read of the shown runs.
 */
export function DailyReport({ scope, dayStart }: { scope: AnalyticsScope; dayStart: string }) {
  const env = useEventHubEnv();
  // the month to date counts in the plant's financial calendar (month close policy); none until it is known
  const calendar = useMonthClose('current').data?.calendar;
  const mtd = calendar ? monthToDateWindow(scope, { dayStart, timeZone: env.timezone, calendar }) : null;
  return (
    <div className="space-y-6" data-testid="daily-report">
      <ReportExportBar kind="daily" query={{ ...scopeBase(scope), monthFrom: mtd?.from }} timezone={env.timezone} />
      <Section scope={scope} title="Chosen days" testId="daily-days" />
      {mtd && <Section scope={{ ...scope, ...mtd, windowLabel: 'Month to date' }} title="Month to date" testId="daily-mtd" />}
      <LossBreakdownCards scope={scope} groupBy="reason" limit={5} title="Top 5 losses" testId="daily-top-losses" />
      <EventStatusCard scope={scope} />
    </div>
  );
}
