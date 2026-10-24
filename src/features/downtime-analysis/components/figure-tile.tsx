import type { KpiAggregateView } from '@/api/v2/types/reports';
import { KpiTile } from '@/features/pla-analytics/dashboard/kpi-tile';
import { DurationText } from '@/features/ux-kit/duration-text';
import { useCalendarPreference } from '@/lib/dates';
import { formatCount, formatRatio, tileInfo, type TileSpec } from '../model/kpi-display';

function TileValue({ spec, value }: { spec: TileSpec; value: string }) {
  const { digits } = useCalendarPreference();
  if (spec.kind === 'duration') return <DurationText seconds={value} />;
  if (spec.kind === 'ratio') return <>{formatRatio(value, 1, digits)}</>;
  return <>{formatCount(value, digits)}</>;
}

/**
 * One server KPI in the dashboard tile (uppercase label, ⓘ, value; no caption): its definition and — for
 * "—", provisional or above-100 % figures — the server's quality and reason are the ⓘ text.
 */
export function FigureTile({ spec, view }: { spec: TileSpec; view: KpiAggregateView | undefined }) {
  const value = view && view.value !== null ? view.value : null;
  return (
    <div className="min-w-0" data-testid={`kpi-${spec.metric}`} data-value={view?.value ?? ''}>
      <KpiTile
        spec={{ title: spec.title, info: tileInfo(spec, view) }}
        value={value === null ? null : <span data-testid="kpi-value"><TileValue spec={spec} value={value} /></span>}
        testId={`kpi-${spec.metric}-tile`}
      />
    </div>
  );
}
