import { CurrentStopsPanel } from '@/features/event-hub/components/current-stops-panel';
import { KpiSummary } from '../components/kpi-summary';
import { TrendPanel } from '../components/trend-panel';
import { pageViews } from '../model/bundle-views';
import type { DowntimePageProps } from './page-types';

export function DowntimeOverviewPage({ filters, bundle, onClose, onCode }: DowntimePageProps) {
  return (
    <div className="space-y-5" data-testid="downtime-view-overview">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <KpiSummary bundle={bundle} compact />
        <div><CurrentStopsPanel unitIds={filters.unitIds} onClose={onClose} onCode={onCode} /><p className="mt-2 text-xs text-muted-foreground">Current stops are live for the selected units. Summary and trend use the chosen production-period window.</p></div>
      </div>
      <TrendPanel filters={filters} bundle={bundle} views={pageViews(filters)} />
    </div>
  );
}
