import { KpiTileRow } from '@/features/pla-analytics/dashboard/kpi-tile';
import { StatusIcon } from '@/lib/icons';
import { useControllableView } from '../hooks/use-controllable-view';
import type { DowntimeBundleResult } from '../hooks/use-downtime-bundle';
import { CALENDAR_TILES, CONTROLLABLE_TILE, findMetric, hasUnknownTime, SUMMARY_TILES } from '../model/kpi-display';
import { CalendarBasisSection } from './calendar-basis-section';
import { ControllableSwitch } from './controllable-switch';
import { DataCoverageNote } from './data-coverage-note';
import { FigureTile } from './figure-tile';
import { ReportCard } from './report-card';

const HEADLINE = new Set(['downtime_total', 'stop_count', 'scheduled_availability', 'coded_downtime_ratio']);

/**
 * KPI summary (KPI05 / KPI06, DT04): the period KPIs of the scope from `GET /reports/downtime-bundle` — the
 * server's summed terms (of the filtered schedule class, when one is chosen) in dashboard tiles, definitions and
 * null reasons behind each ⓘ; nothing is added up here. The switch adds the server's controllable availability
 * (SME D15). Units/days without a calculation run follow under their own "Calendar basis" badge (plan 2.3).
 */
export function KpiSummary({ bundle, compact = false }: { bundle: DowntimeBundleResult; compact?: boolean }) {
  const summary = bundle.data?.data.summary;
  const [controllable, setControllable] = useControllableView();
  const shown = compact ? SUMMARY_TILES.filter((tile) => HEADLINE.has(tile.metric)) : SUMMARY_TILES;
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
      <DataCoverageNote coverage={bundle.data?.data.dataCoverage} />
      <UnknownTimeNote show={hasUnknownTime(summary)} />
      <KpiTileRow className={compact ? 'sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4' : undefined}>
        {tiles.map((tile) => <FigureTile key={tile.metric} spec={tile} view={findMetric(summary, tile.metric)} />)}
      </KpiTileRow>
      {compact && (
        <details>
          <summary className="cursor-pointer text-sm text-primary">More downtime figures</summary>
          <KpiTileRow className="mt-3 lg:grid-cols-4 xl:grid-cols-4">
            {SUMMARY_TILES.filter((tile) => !HEADLINE.has(tile.metric)).map((tile) => <FigureTile key={tile.metric} spec={tile} view={findMetric(summary, tile.metric)} />)}
          </KpiTileRow>
        </details>
      )}
      <CalendarBasisSection calendar={bundle.data?.data.calendarBasis}>
        <div data-testid="calendar-basis-tiles">
          <KpiTileRow>
            {CALENDAR_TILES.map((tile) => <FigureTile key={tile.metric} spec={tile} view={findMetric(bundle.data?.data.calendarBasis?.total, tile.metric)} />)}
          </KpiTileRow>
        </div>
      </CalendarBasisSection>
    </ReportCard>
  );
}

/** DT-02: some stop time has no planned / unplanned class yet, so that split is incomplete. */
function UnknownTimeNote({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p className="flex items-center gap-1.5 text-xs text-warning" role="note" data-testid="unknown-lower-bound">
      <StatusIcon.warning aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      Some stop time is not classed planned or unplanned yet: the planned / unplanned split is incomplete.
    </p>
  );
}
