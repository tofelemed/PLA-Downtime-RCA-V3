import { lazy, Suspense } from 'react';
import { useDowntimeReport } from '@/api/v2/queries/reports';
import type { DowntimeGroupView } from '@/api/v2/types/reports';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { DurationText } from '@/features/ux-kit/duration-text';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import type { DowntimeFilters, DowntimeMetric } from '../model/downtime-filters';
import { formatCount, formatRatio } from '../model/kpi-display';
import { barAction, drillCrumbs, paretoQuery, type DrillSelection } from '../model/reason-drill';
import { ReportCard } from './report-card';

const ParetoChart = lazy(() => import('./charts/pareto-chart').then((module) => ({ default: module.ParetoChart })));

export interface ReasonParetoProps {
  filters: DowntimeFilters;
  onChange: (patch: Partial<DowntimeFilters>) => void;
  /** a leaf (or not-coded) bar was chosen: list its events */
  onEvents: (selection: DrillSelection) => void;
}

/**
 * Reason Pareto (AN01): level-1 reasons, then the children of the chosen reason, down to the event list;
 * duration or frequency; bars and the cumulative share are the server's.
 */
export function ReasonPareto({ filters, onChange, onEvents }: ReasonParetoProps) {
  const env = useEventHubEnv();
  const query = useDowntimeReport(paretoQuery(filters), env.timezone);
  const report = query.data?.data;
  const groups = report?.groups ?? [];
  const labelOf = (group: DowntimeGroupView) => group.label ?? (group.key ? 'Unknown reason' : 'Not coded');
  const choose = (group: DowntimeGroupView) => {
    const action = barAction(group, filters.reasonPath, env.reasonCodes);
    if (action.kind === 'drill') onChange({ reasonPath: [...filters.reasonPath, action.reasonId] });
    else onEvents({ reasonId: action.reasonId, label: labelOf(group), group, unit: report?.unit ?? 's' });
  };
  return (
    <ReportCard
      title="Downtime by reason"
      testId="reason-pareto"
      query={query}
      response={query.data}
      isEmpty={groups.length === 0}
      emptyText="No coded or uncoded downtime in the calculated periods."
      actions={<MetricToggle metric={filters.metric} onChange={(metric) => onChange({ metric })} />}
      note={<Breadcrumb path={filters.reasonPath} onChange={(reasonPath) => onChange({ reasonPath })} />}
    >
      <Suspense fallback={<Skeleton className="h-72 w-full" />}>
        <ParetoChart groups={groups} unit={report?.unit ?? 's'} labelOf={labelOf} onBar={choose} />
      </Suspense>
      <ol className="space-y-1" aria-label="Reasons, largest first">
        {groups.map((group) => (
          <li key={group.key ?? 'none'}>
            <button
              type="button"
              className="flex w-full flex-wrap items-center justify-between gap-2 rounded px-2 py-1 text-left text-sm hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-testid="pareto-bar"
              data-key={group.key ?? ''}
              data-value={group.value}
              data-cumulative={group.cumulativeShare ?? ''}
              onClick={() => choose(group)}
            >
              <span className="font-medium">{labelOf(group)}</span>
              <span className="flex gap-3 font-mono text-xs">
                <span data-testid="pareto-value">{report?.unit === 'count' ? formatCount(group.value) : <DurationText seconds={group.value} variant="compact" />}</span>
                <span>{formatRatio(group.share)}</span>
                <span data-testid="pareto-cumulative">Σ {formatRatio(group.cumulativeShare)}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </ReportCard>
  );
}

function MetricToggle({ metric, onChange }: { metric: DowntimeMetric; onChange: (metric: DowntimeMetric) => void }) {
  return (
    <ToggleGroup type="single" size="sm" value={metric} onValueChange={(value) => value && onChange(value as DowntimeMetric)} aria-label="Measure">
      <ToggleGroupItem value="duration">Duration</ToggleGroupItem>
      <ToggleGroupItem value="frequency">Frequency</ToggleGroupItem>
    </ToggleGroup>
  );
}

function Breadcrumb({ path, onChange }: { path: string[]; onChange: (path: string[]) => void }) {
  const env = useEventHubEnv();
  const crumbs = drillCrumbs(path, env.reasonCodes);
  return (
    <nav aria-label="Reason level" className="flex flex-wrap items-center gap-1" data-testid="pareto-breadcrumb">
      <Button variant="link" size="sm" className="h-auto p-0" onClick={() => onChange([])} disabled={path.length === 0}>
        All reasons
      </Button>
      {crumbs.map((crumb, index) => (
        <span key={crumb.id} className="flex items-center gap-1">
          <span aria-hidden>›</span>
          <Button variant="link" size="sm" className="h-auto p-0" onClick={() => onChange(path.slice(0, index + 1))} disabled={index === crumbs.length - 1}>
            {crumb.label}
          </Button>
        </span>
      ))}
    </nav>
  );
}
