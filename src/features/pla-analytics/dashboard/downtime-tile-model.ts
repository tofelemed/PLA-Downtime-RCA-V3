import type { KpiAggregateView } from '@/api/v2/types/reports';
import { findMetric, SUMMARY_TILES, type TileSpec } from '@/features/downtime-analysis/model/kpi-display';
import { SCHEDULED_AVAILABILITY_CAPTION } from './availability-captions';
import type { AssetFigures } from './downtime-series-model';
import { unavailableReason } from './kpi-unavailable';

export const NOT_FOR_ASSET = 'Not available for a single asset';
export const NO_ASSET_STOPS = 'No stops recorded for this asset in this window.';
export const DOWNTIME_ASSET_NOTE = "Downtime is reported per unit — the trend and causes show the selected asset's unit.";

const SHOWN = ['downtime_total', 'downtime_planned', 'downtime_unplanned', 'stop_count', 'scheduled_availability'];

/** The five headline tiles in display order; scheduled availability says in its tooltip that it is not the OEE availability. */
export const DOWNTIME_TILES: readonly TileSpec[] = SUMMARY_TILES.filter((tile) => SHOWN.includes(tile.metric)).map((tile) =>
  tile.metric === 'scheduled_availability' ? { ...tile, note: SCHEDULED_AVAILABILITY_CAPTION } : tile,
);

export interface TileFigure {
  /** the server's value, or null when there is none */
  value: string | null;
  info: string;
  highlight: boolean;
}

function assetFigure(spec: TileSpec, asset: AssetFigures): Omit<TileFigure, 'highlight'> {
  const row = spec.metric === 'downtime_total' ? asset.duration : spec.metric === 'stop_count' ? asset.stops : null;
  if (row === null) return { value: null, info: NOT_FOR_ASSET };
  return { value: row?.value ?? null, info: row ? spec.note : `${spec.note} ${NO_ASSET_STOPS}` };
}

/** One tile's figure: the unit's summary KPI, or — with an asset selected — the asset's own row (or "—" with the reason). */
export function tileFigure(spec: TileSpec, summary: readonly KpiAggregateView[] | undefined, asset: AssetFigures | null): TileFigure {
  const highlight = spec.metric === 'downtime_unplanned';
  if (asset) return { ...assetFigure(spec, asset), highlight };
  const view = findMetric(summary, spec.metric);
  const reason = unavailableReason(view);
  if (reason !== null) return { value: null, info: `${spec.note} Not available: ${reason}.`, highlight };
  return { value: view?.value ?? null, info: spec.note, highlight };
}
