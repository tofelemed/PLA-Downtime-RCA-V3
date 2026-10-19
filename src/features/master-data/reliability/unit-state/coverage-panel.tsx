import { useUnitStateCoverage } from '@/api/v2/queries/reliability-unit-state';
import type { UnitStateCoverageView } from '@/api/v2/types/reliability';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { DateRangeInput } from '@/features/ux-kit/date-inputs';
import { usePlantWindow } from '../shared/use-plant-window';
import type { ReliabilityFormat } from '../shared/use-reliability-format';
import { StateTimeline } from './state-timeline';
import { CoverageFacts } from './coverage-facts';
import { productionDayWindow } from '@/features/ux-kit/production-day-window';
import { useOperationalDayStart } from '@/features/ux-kit/use-operational-day-start';

function CoverageResult({ view, format }: { view: UnitStateCoverageView; format: ReliabilityFormat }) {
  if (!view.coverage) return <p className="text-sm text-muted-foreground">The unit has no state mapping in this window.</p>;
  const startsAt = view.coverageStartsAt ?? null;
  return (
    <div className="space-y-3">
      {startsAt && (
        <p className="text-sm text-muted-foreground" data-testid="coverage-starts-at">
          Coverage starts at {format.dateTime(startsAt)}, when the first state mapping came into force.
        </p>
      )}
      <CoverageFacts coverage={view.coverage} format={format} />
      <StateTimeline segments={view.segments} from={startsAt ?? view.from} to={view.to} format={format} />
      {view.truncated && <p className="text-xs text-muted-foreground">The timeline shows the first segments only; the figures count them all.</p>}
    </div>
  );
}

/**
 * SME D2 coverage of a unit over a window (at most 31 days): unknown time is never filled, so availability
 * is published as lower / upper bounds with the share of the scheduled time the data covers.
 */
export function CoveragePanel({ unitId, format }: { unitId: string; format: ReliabilityFormat }) {
  const { range, setRange, window } = usePlantWindow(7, format.timezone, true);
  // date-only selections are production days (QA re-test decision); null while the plant's day start loads
  const dayStart = useOperationalDayStart();
  const days = window && dayStart ? productionDayWindow(window, dayStart, format.timezone) : null;
  const coverage = useUnitStateCoverage(days?.from && days.to ? { unitId, from: days.from, to: days.to } : null);
  return (
    <div className="space-y-3">
      <DateRangeInput label="Window (whole production days, at most 31)" value={range} timeZone={format.timezone} onChange={setRange} />
      {dayStart && dayStart !== '00:00' && <p className="text-xs text-muted-foreground">Each production day runs from {dayStart} to {dayStart} the next day.</p>}
      <DataState state={dataStateOf(coverage)} error={coverage.error} onRetry={() => void coverage.refetch()}>
        {coverage.data && <CoverageResult view={coverage.data} format={format} />}
      </DataState>
    </div>
  );
}
