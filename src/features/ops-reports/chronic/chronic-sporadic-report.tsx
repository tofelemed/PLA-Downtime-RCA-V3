import { useState } from 'react';
import { useChronicSporadic } from '@/api/v2/queries/ops-reports';
import type { ChronicRowView, Quadrant } from '@/api/v2/types/ops-reports';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { AnalyticsCard } from '@/features/pla-analytics/components/analytics-card';
import { SELECT_CLASS } from '@/features/pla-analytics/components/analytics-filters';
import { scopeBase, type AnalyticsScope } from '@/features/pla-analytics/model/analytics-scope';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { DurationText } from '@/features/ux-kit/duration-text';
import { NumberText } from '@/features/ux-kit/number-text';
import { ReportExportBar } from '../components/report-export-bar';

const QUADRANT_LABELS: Record<Quadrant, { label: string; advice: string }> = {
  chronic: { label: 'Chronic', advice: 'frequent and short: find the systematic cause (RCA)' },
  sporadic: { label: 'Sporadic', advice: 'rare and long: restore fast, prevent the failure mode' },
  major: { label: 'Major', advice: 'frequent and long: first priority' },
  minor: { label: 'Minor', advice: 'rare and short' },
};

const COLUMNS: Array<DataTableColumn<ChronicRowView>> = [
  { id: 'name', header: 'Cause', cell: (r) => <span data-testid="chronic-row" data-quadrant={r.quadrant ?? ''}>{r.label ?? (r.key ? 'Unknown' : 'Not coded')}</span> },
  { id: 'stops', header: 'Stops', align: 'right', cell: (r) => <NumberText value={r.stops} /> },
  { id: 'seconds', header: 'Downtime', align: 'right', nowrap: true, cell: (r) => <DurationText seconds={r.seconds} /> },
  { id: 'mean', header: 'Mean stop', align: 'right', nowrap: true, cell: (r) => (r.meanSeconds === null ? '—' : <DurationText seconds={r.meanSeconds} />) },
  {
    id: 'quadrant',
    header: 'Pattern',
    cell: (r) => (r.quadrant ? <Badge variant={r.quadrant === 'major' ? 'destructive' : 'secondary'} title={QUADRANT_LABELS[r.quadrant].advice}>{QUADRANT_LABELS[r.quadrant].label}</Badge> : '—'),
  },
];

function Medians({ stops, mean }: { stops: string | null; mean: string | null }) {
  if (stops === null || mean === null) return null;
  return (
    <p className="text-xs text-muted-foreground" data-testid="chronic-medians">
      Cut at the medians of these dates: <NumberText value={stops} fractionDigits={1} /> stops and a mean stop of <DurationText seconds={mean} />. Chronic = more stops than the median and shorter;
      sporadic = fewer and longer.
    </p>
  );
}

/**
 * Chronic vs sporadic losses (R7, production engineer): unplanned stops per reason or asset by frequency and
 * mean length, each placed against the medians of the chosen dates — chronic losses call for a systematic
 * fix, sporadic ones for prevention of the failure mode.
 */
export function ChronicSporadicReport({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const [groupBy, setGroupBy] = useState<'reason' | 'asset'>('reason');
  const query = useChronicSporadic({ ...scopeBase(scope), groupBy }, env.timezone);
  const data = query.data?.data;
  const controls = (
    <div className="flex flex-wrap items-center gap-2">
      <ReportExportBar kind="chronic" query={{ ...scopeBase(scope), groupBy }} timezone={env.timezone} />
      <Label htmlFor="chronic-group">Group by</Label>
      <select id="chronic-group" className={SELECT_CLASS} value={groupBy} onChange={(e) => setGroupBy(e.target.value === 'asset' ? 'asset' : 'reason')}>
        <option value="reason">Reason</option>
        <option value="asset">Asset</option>
      </select>
    </div>
  );
  return (
    <AnalyticsCard title="Chronic and sporadic losses" testId="chronic-sporadic" query={query} response={query.data} approvedOnly={scope.approvedOnly} isEmpty={data !== undefined && data.rows.length === 0} emptyText="No unplanned stops on these dates." actions={controls}>
      {data && (
        <div className="space-y-2">
          <Medians stops={data.medianStops} mean={data.medianMeanSeconds} />
          <DataTable caption="Chronic and sporadic losses" columns={COLUMNS} rows={data.rows} getRowKey={(r) => r.key ?? '-'} density="compact" />
          {data.truncated && <p className="text-xs text-muted-foreground">Showing the 100 causes with the most downtime.</p>}
        </div>
      )}
    </AnalyticsCard>
  );
}
