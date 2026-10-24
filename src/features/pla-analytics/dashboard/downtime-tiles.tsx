import type { KpiAggregateView } from '@/api/v2/types/reports';
import { CONTROLLABLE_TILE, formatCount, formatRatio, type TileSpec } from '@/features/downtime-analysis/model/kpi-display';
import { DurationText } from '@/features/ux-kit/duration-text';
import { useCalendarPreference } from '@/lib/dates';
import type { AssetFigures } from './downtime-series-model';
import { DOWNTIME_TILES, tileFigure } from './downtime-tile-model';
import { KpiTile, KpiTileRow } from './kpi-tile';

function FigureText({ spec, value }: { spec: TileSpec; value: string }) {
  const { digits } = useCalendarPreference();
  if (spec.kind === 'duration') return <DurationText seconds={value} />;
  return <>{spec.kind === 'ratio' ? formatRatio(value, 1, digits) : formatCount(value, digits)}</>;
}

export interface DowntimeTilesProps {
  summary: readonly KpiAggregateView[] | undefined;
  asset: AssetFigures | null;
  controllable: boolean;
}

/** Total, planned and unplanned downtime, stops and scheduled availability (server figures; the controllable view adds its own tile). */
export function DowntimeTiles({ summary, asset, controllable }: DowntimeTilesProps) {
  const tiles = controllable ? [...DOWNTIME_TILES, CONTROLLABLE_TILE] : DOWNTIME_TILES;
  return (
    <KpiTileRow>
      {tiles.map((spec) => {
        const figure = tileFigure(spec, summary, asset);
        const value =
          figure.value === null ? null : (
            <span data-testid="downtime-tile-value">
              <FigureText spec={spec} value={figure.value} />
            </span>
          );
        return <KpiTile key={spec.metric} spec={{ title: spec.title, info: figure.info, highlight: figure.highlight }} value={value} testId={`dashboard-downtime-${spec.metric}-tile`} />;
      })}
    </KpiTileRow>
  );
}
