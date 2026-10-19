import { useUnitStateCoverage } from '@/api/v2/queries/reliability-unit-state';
import type { StateCoverage, UnitStateCoverageView } from '@/api/v2/types/reliability';
import { Badge } from '@/components/ui/badge';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { DateRangeInput } from '@/features/ux-kit/date-inputs';
import { usePlantWindow } from '../shared/use-plant-window';
import type { ReliabilityFormat } from '../shared/use-reliability-format';
import { StateTimeline } from './state-timeline';

/** A server ratio (0..1) as a percentage; "—" without scheduled time. */
const ratio = (value: number | null, format: ReliabilityFormat) => (value === null ? '—' : format.percent(value * 100, 1));

function CoverageFacts({ coverage, format }: { coverage: StateCoverage; format: ReliabilityFormat }) {
  return (
    <dl className="grid grid-cols-[14rem_1fr] gap-x-3 gap-y-1 text-sm" data-testid="coverage-facts">
      <dt className="text-muted-foreground">Availability</dt>
      <dd className="flex flex-wrap items-center gap-2">
        between {ratio(coverage.availabilityLower, format)} and {ratio(coverage.availabilityUpper, format)}
        <Badge variant="outline">Provisional</Badge>
      </dd>
      <dt className="text-muted-foreground">Known-data coverage</dt>
      <dd>{ratio(coverage.coverage, format)}</dd>
      <dt className="text-muted-foreground">On observed time only</dt>
      <dd>{ratio(coverage.knownTimeAvailability, format)} (not the certified availability)</dd>
      <dt className="text-muted-foreground">Scheduled</dt>
      <dd>{format.duration(coverage.scheduledSeconds)}</dd>
      <dt className="text-muted-foreground">Running · known stopped · unknown</dt>
      <dd>{format.duration(coverage.runningSeconds)} · {format.duration(coverage.knownStoppedSeconds)} · {format.duration(coverage.unknownSeconds)}</dd>
    </dl>
  );
}

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
  const { range, setRange, window } = usePlantWindow(7, format.timezone);
  const coverage = useUnitStateCoverage(window ? { unitId, ...window } : null);
  return (
    <div className="space-y-3">
      <DateRangeInput label="Window (at most 31 days)" value={range} timeZone={format.timezone} onChange={setRange} />
      <DataState state={dataStateOf(coverage)} error={coverage.error} onRetry={() => void coverage.refetch()}>
        {coverage.data && <CoverageResult view={coverage.data} format={format} />}
      </DataState>
    </div>
  );
}
