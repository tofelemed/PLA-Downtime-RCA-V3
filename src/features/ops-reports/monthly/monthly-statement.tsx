import { useState } from 'react';
import { useMonthClose, type MonthSelection } from '@/api/v2/queries/month-close';
import type { MonthCloseView } from '@/api/v2/types/month-close';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { MonthNav } from '@/features/month-close/components/month-nav';
import { scopeBase, type AnalyticsScope } from '@/features/pla-analytics/model/analytics-scope';
import { EconomicBreakdownCard } from '@/features/pla-analytics/reports/economic-breakdown-card';
import { LossValueCard } from '@/features/pla-analytics/reports/loss-value-card';
import { WaterfallTab } from '@/features/pla-analytics/tabs/waterfall-tab';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { LossBreakdownCards } from '../components/loss-breakdown-cards';
import { ReportExportBar } from '../components/report-export-bar';
import { monthWindow } from '../model/month-window';
import { MonthStatusCard } from './month-status-card';
import { RestatementsCard } from './restatements-card';

function StatementBody({ view, scope }: { view: MonthCloseView; scope: AnalyticsScope }) {
  const { canViewMoney } = useCapabilities();
  return (
    <div className="space-y-4">
      <MonthStatusCard view={view} />
      <WaterfallTab scope={{ ...scope, ledger: 'capacity' }} />
      <LossBreakdownCards scope={scope} groupBy="kind" title="Losses by category" testId="statement-categories" />
      <LossBreakdownCards scope={scope} groupBy="reason" limit={10} title="Top 10 losses" testId="statement-reasons" />
      {canViewMoney && <LossValueCard scope={{ ...scope, ledger: 'plan' }} />}
      {canViewMoney && <EconomicBreakdownCard scope={scope} />}
      <RestatementsCard scope={scope} />
    </div>
  );
}

/**
 * Monthly loss accounting statement (R3, production accountant, finance, plant manager): one financial
 * month of the chosen units — certification state, the waterfall from capacity to good output, losses by
 * category and reason in quantity and value, unvalued lines (in the value cards) and restatements.
 * Exported as a designed PDF or a workbook.
 */
export function MonthlyStatement({ scope, dayStart }: { scope: AnalyticsScope; dayStart: string }) {
  const env = useEventHubEnv();
  const [month, setMonth] = useState<MonthSelection>('current');
  const query = useMonthClose(month);
  const view = query.data;
  const span = view ? monthWindow(view, dayStart, env.timezone) : null;
  return (
    <div className="space-y-4" data-testid="monthly-statement">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        {view && <MonthNav view={view} onSelect={setMonth} />}
        <ReportExportBar kind="monthly" query={view && span ? { ...scopeBase({ ...scope, ...span }), month: view.monthKey } : null} timezone={env.timezone} />
      </div>
      <DataState state={dataStateOf(query)} error={query.error} onRetry={() => void query.refetch()}>
        {view && span && <StatementBody view={view} scope={{ ...scope, ...span, windowLabel: view.monthKey }} />}
      </DataState>
    </div>
  );
}
