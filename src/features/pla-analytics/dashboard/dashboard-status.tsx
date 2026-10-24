import { useOeeReport } from '@/api/v2/queries/reports';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatRatio } from '@/features/downtime-analysis/model/kpi-display';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { freshnessOf } from '@/features/ux-kit/format/freshness';
import { formatPlantTime } from '@/features/ux-kit/format/plant-time';
import { policyVersionsLabel } from '@/features/ux-kit/labels';
import { localizeNumber, toDigits, useCalendarPreference } from '@/lib/dates';
import { StatusIcon } from '@/lib/icons';
import { oeeQuery, type AnalyticsScope } from '../model/analytics-scope';
import { coverageText } from '../model/display';
import { shownAsProvisional } from '../model/provisional';

/**
 * The dashboard's one status: "As of …" and a single Provisional / Approved badge. The badge opens the
 * incomplete-data note and the calculation runs, policy versions and coverage behind the figures.
 */
export function DashboardStatus({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const pref = useCalendarPreference();
  const { data: response, isError } = useOeeReport(oeeQuery(scope, 'unit', 'operational'), env.timezone);
  if (!response) return <span className="text-muted-foreground" data-testid="dashboard-snapshot">{isError ? 'No snapshot for this scope.' : 'Loading the snapshot…'}</span>;
  const runIds = response.data.calculationRunIds;
  const coverage = coverageText(formatRatio(String(response.coverage.ratio), 0, pref.digits), false);
  const incomplete = response.coverage.ratio < 1 || response.dataQuality.missingCount > 0;
  const provisional = shownAsProvisional(response, false);
  const freshness = freshnessOf(response.asOf, Date.now());
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="dashboard-snapshot" data-run-ids={[...runIds].sort().join(',')}>
      <span className="text-muted-foreground">
        As of {formatPlantTime(response.asOf, env.timezone, true, pref)}
        {freshness ? ` · ${toDigits(freshness, pref.digits)}` : ''}
      </span>
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${provisional ? 'Provisional' : 'Approved'}, show details`}>
            <Badge variant={provisional ? 'secondary' : 'default'}>{provisional ? 'Provisional' : 'Approved'}</Badge>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="space-y-2 text-xs">
          {incomplete && (
            <p className="flex items-center gap-1" data-testid="snapshot-incomplete">
              <StatusIcon.warning className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Incomplete data: only calculated periods are counted ({coverage}).
            </p>
          )}
          <p className="text-muted-foreground">
            {localizeNumber(runIds.length === 1 ? '1 calculation run' : `${runIds.length} calculation runs`, pref.digits)} · {policyVersionsLabel(response.policyVersion)} · {coverage}
          </p>
        </PopoverContent>
      </Popover>
    </div>
  );
}
