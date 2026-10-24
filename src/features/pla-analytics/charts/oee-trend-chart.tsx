import { useState } from 'react';
import { useOeeReport } from '@/api/v2/queries/reports';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { useCalendarPreference } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { SeriesChart } from './series-chart';
import { oeeQuery, type AnalyticsScope } from '../model/analytics-scope';
import { bucketLabel } from '../model/buckets';
import { OEE_METRIC_LABELS } from '../model/display';
import { oeeRows } from '../model/series';

const OEE_SERIES = { key: 'oee', label: OEE_METRIC_LABELS.oee, colour: 'hsl(var(--primary))' };
const COMPONENT_SERIES = [
  { key: 'availability', label: OEE_METRIC_LABELS.availability, colour: 'hsl(var(--danger))' },
  { key: 'performance', label: OEE_METRIC_LABELS.performance, colour: 'hsl(var(--chart-2))' },
  { key: 'quality', label: OEE_METRIC_LABELS.quality, colour: 'hsl(var(--warning))' },
] as const;

/** Legend and toggles: OEE is always drawn; each component line is switched on by its button. */
function SeriesToggles({ shown, onToggle }: { shown: ReadonlySet<string>; onToggle: (key: string) => void }) {
  return (
    <div role="group" aria-label="Lines on the chart" className="flex flex-wrap items-center gap-2 text-xs" data-testid="oee-trend-toggles">
      <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium">
        <span aria-hidden="true" className="h-0.5 w-4" style={{ backgroundColor: OEE_SERIES.colour }} />
        {OEE_SERIES.label}
      </span>
      {COMPONENT_SERIES.map((s) => {
        const on = shown.has(s.key);
        return (
          <button
            key={s.key}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(s.key)}
            className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', on ? 'bg-muted' : 'text-muted-foreground')}
          >
            <span aria-hidden="true" className="h-0.5 w-4" style={{ backgroundColor: s.colour, opacity: on ? 1 : 0.4 }} />
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

/** OEE per step of the period from the server (no target line: the plant has no OEE target setting). */
export function OeeTrendChart({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const pref = useCalendarPreference();
  const query = useOeeReport(oeeQuery(scope, scope.trendBy, 'operational'), env.timezone);
  const [shown, setShown] = useState<ReadonlySet<string>>(new Set());
  const toggle = (key: string) => setShown((prev) => new Set(prev.has(key) ? [...prev].filter((k) => k !== key) : [...prev, key]));
  const rows = oeeRows(query.data?.data, (key) => bucketLabel(key, scope.trendBy, pref));
  const series = [OEE_SERIES, ...COMPONENT_SERIES.filter((s) => shown.has(s.key))];
  const state = dataStateOf(query, { isEmpty: rows.length === 0 });
  return (
    <div className="space-y-2" data-testid="oee-trend">
      <h3 className="text-sm font-medium">OEE trend</h3>
      <SeriesToggles shown={shown} onToggle={toggle} />
      <DataState state={state} error={query.error} onRetry={() => query.refetch()} detail="No OEE periods in this window.">
        <SeriesChart rows={rows} series={series} kind="line" ratio valuesTable legend={false} />
      </DataState>
    </div>
  );
}
