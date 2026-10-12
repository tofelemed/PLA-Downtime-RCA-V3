import type { KpiAggregateView } from '@/api/v2/types/reports';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { DurationText } from '@/features/ux-kit/duration-text';
import { labelOf } from '@/features/ux-kit/labels';
import type { DowntimeBundleResult } from '../hooks/use-downtime-bundle';
import { findMetric, formatCount, formatRatio, hasUnknownTime, reasonText, SUMMARY_TILES, type TileSpec } from '../model/kpi-display';
import { ReportCard } from './report-card';

const QUALITY_LABELS: Readonly<Record<string, string>> = {
  ok: 'OK',
  provisional: 'Provisional',
  unavailable: 'Not available',
  exception: 'Above 100 %',
};

/**
 * KPI summary (KPI05 / KPI06, DT04): the period KPIs of the scope from `GET /reports/downtime` — the
 * server's summed terms, shown with their labels, cohorts and null reasons; nothing is added up here.
 */
export function KpiSummary({ bundle }: { bundle: DowntimeBundleResult }) {
  const summary = bundle.data?.data.summary;
  return (
    <ReportCard title="Downtime summary" testId="kpi-summary" query={bundle} response={bundle.data} showMeta={false}>
      {hasUnknownTime(summary) && (
        <Alert className="mb-2" data-testid="unknown-lower-bound">
          <AlertDescription>Unknown time is above zero: known downtime is a lower bound.</AlertDescription>
        </Alert>
      )}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {SUMMARY_TILES.map((tile) => (
          <KpiTile key={tile.metric} spec={tile} view={findMetric(summary, tile.metric)} />
        ))}
      </dl>
    </ReportCard>
  );
}

function TileValue({ spec, view }: { spec: TileSpec; view: KpiAggregateView }) {
  if (spec.kind === 'duration') return <DurationText seconds={view.value} variant="clock" />;
  if (spec.kind === 'ratio') return <>{formatRatio(view.value)}</>;
  return <>{formatCount(view.value)}</>;
}

/** One server KPI: value, or "—" with the server's reason; provisional / exception flagged in text. */
export function KpiTile({ spec, view }: { spec: TileSpec; view: KpiAggregateView | undefined }) {
  const reason = reasonText(view?.reason);
  return (
    <div className="rounded-md border p-3" data-testid={`kpi-${spec.metric}`} data-value={view?.value ?? ''}>
      <dt className="text-xs text-muted-foreground" title={spec.note}>
        {spec.title}
      </dt>
      <dd className="text-xl font-semibold" data-testid="kpi-value">
        {view && view.value !== null ? <TileValue spec={spec} view={view} /> : '—'}
      </dd>
      <dd className="text-[11px] text-muted-foreground">{spec.note}</dd>
      {view && view.quality !== 'ok' && (
        <dd className="mt-1 flex flex-wrap items-center gap-1 text-[11px]">
          <Badge variant={view.quality === 'exception' ? 'destructive' : 'secondary'}>{labelOf(QUALITY_LABELS, view.quality)}</Badge>
          {reason && <span>{reason}</span>}
        </dd>
      )}
    </div>
  );
}
