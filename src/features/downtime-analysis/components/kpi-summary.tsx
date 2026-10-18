import { useState } from 'react';
import type { KpiAggregateView } from '@/api/v2/types/reports';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useCalendarPreference } from '@/lib/dates';
import { DurationText } from '@/features/ux-kit/duration-text';
import { labelOf } from '@/features/ux-kit/labels';
import type { DowntimeBundleResult } from '../hooks/use-downtime-bundle';
import { CONTROLLABLE_TILE, findMetric, formatCount, formatRatio, hasUnknownTime, reasonText, SUMMARY_TILES, type TileSpec } from '../model/kpi-display';
import { ControllableSwitch } from './controllable-switch';
import { ReportCard } from './report-card';

const QUALITY_LABELS: Readonly<Record<string, string>> = {
  ok: 'OK',
  provisional: 'Provisional',
  unavailable: 'Not available',
  exception: 'Above 100 %',
};

/**
 * KPI summary (KPI05 / KPI06, DT04): the period KPIs of the scope from `GET /reports/downtime` — the
 * server's summed terms, shown with their labels, cohorts and null reasons; nothing is added up here. The
 * switch adds the server's controllable availability (SME D15) beside the headline figures.
 */
export function KpiSummary({ bundle, compact = false }: { bundle: DowntimeBundleResult; compact?: boolean }) {
  const summary = bundle.data?.data.summary;
  const [controllable, setControllable] = useState(false);
  const headline = new Set(['downtime_total', 'stop_count', 'scheduled_availability', 'coded_downtime_ratio']);
  const shown = compact ? SUMMARY_TILES.filter((tile) => headline.has(tile.metric)) : SUMMARY_TILES;
  const tiles = controllable ? [...shown, CONTROLLABLE_TILE] : shown;
  return (
    <ReportCard
      title="Downtime summary"
      testId="kpi-summary"
      query={bundle}
      response={bundle.data}
      showMeta={false}
      actions={<ControllableSwitch checked={controllable} onChange={setControllable} />}
    >
      {hasUnknownTime(summary) && (
        <Alert className="mb-2" data-testid="unknown-lower-bound">
          <AlertDescription>Some stop time is not classed planned or unplanned yet: the planned / unplanned split is incomplete.</AlertDescription>
        </Alert>
      )}
      <dl className={compact ? 'grid grid-cols-2 gap-3 lg:grid-cols-4' : 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5'}>
        {tiles.map((tile) => (
          <KpiTile key={tile.metric} spec={tile} view={findMetric(summary, tile.metric)} />
        ))}
      </dl>
      {compact && <details className="mt-3"><summary className="cursor-pointer text-sm text-primary">More downtime figures</summary>
        <dl className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">{SUMMARY_TILES.filter((tile) => !headline.has(tile.metric)).map((tile) => <KpiTile key={tile.metric} spec={tile} view={findMetric(summary, tile.metric)} />)}</dl>
      </details>}
    </ReportCard>
  );
}

function TileValue({ spec, view }: { spec: TileSpec; view: KpiAggregateView }) {
  const { digits } = useCalendarPreference();
  if (spec.kind === 'duration') return <DurationText seconds={view.value} />;
  if (spec.kind === 'ratio') return <>{formatRatio(view.value, 1, digits)}</>;
  return <>{formatCount(view.value, digits)}</>;
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
      <dd className="text-xs text-muted-foreground">{spec.note}</dd>
      {view && view.quality !== 'ok' && (
        <dd className="mt-1 flex flex-wrap items-center gap-1 text-xs">
          <Badge variant={view.quality === 'exception' ? 'destructive' : 'secondary'}>{labelOf(QUALITY_LABELS, view.quality)}</Badge>
          {reason && <span>{reason}</span>}
        </dd>
      )}
    </div>
  );
}
