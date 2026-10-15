import { Dec } from '../actuals/decimal';
import {
  BoundedInterval,
  clip,
  Interval,
  union,
  unionSeconds,
} from '../time/interval-algebra';
import { KpiDraft, KpiScope } from './kpi.types';
import { ratioKpi } from './kpi-values';

/** SME D9: a standby asset of the unit and its own running periods (`standby_records` runs). */
export interface StandbyExposure {
  assetId: string;
  /** runs touching the window; an open run is measured to `asOf` */
  runs: readonly Interval[];
}

interface Failure {
  start: Date;
}

/** The asset's runs inside the window (open runs to `asOf`), merged. */
function runsIn(
  standby: StandbyExposure,
  window: BoundedInterval,
  asOf: Date,
): BoundedInterval[] {
  return union(
    standby.runs.flatMap((run) => {
      const part = clip({ start: run.start, end: run.end ?? asOf }, window);
      return part ? [part] : [];
    }),
  );
}

const startsIn = (at: Date, span: BoundedInterval) =>
  at >= span.start && at < span.end;

/**
 * SME D9 / DT-10: operating MTBF of a standby asset = its own running seconds in the window / its D13
 * failures that started while it was running. Failures outside its runs (failed start, dormant failure
 * found on demand) are failure on demand, kept apart in the standby measures and only counted in the
 * cohort; standby time never adds exposure. Zero failures → null with the exposure (never "infinite").
 */
export function standbyMtbf(
  context: { window: BoundedInterval; asOf: Date; scope: KpiScope },
  standby: StandbyExposure,
  failures: readonly Failure[],
): KpiDraft {
  const { window, asOf, scope } = context;
  const runs = runsIn(standby, window, asOf);
  const started = failures.filter((f) => startsIn(f.start, window));
  const running = started.filter((f) =>
    runs.some((run) => startsIn(f.start, run)),
  );
  const runningSeconds = unionSeconds(runs);
  return ratioKpi(
    { metric: 'mtbf', scope, unit: 's' },
    {
      numerator: new Dec(runningSeconds),
      denominator: new Dec(running.length),
      cohort: {
        exposureBasis: 'asset_running_time',
        failureDefinition: 'D13',
        failuresOutsideRunning: started.length - running.length,
      },
    },
    runningSeconds > 0 ? 'no_failures' : 'no_running_exposure',
  );
}
