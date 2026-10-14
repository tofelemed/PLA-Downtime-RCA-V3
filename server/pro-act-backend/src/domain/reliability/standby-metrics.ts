import { BoundedInterval } from '../time/interval-algebra';

export interface StandbyLogEntry {
  kind: 'demand' | 'test' | 'run';
  start: Date;
  end: Date | null;
  outcome: 'success' | 'failed_start' | 'failed_while_running';
}

/** A ratio with its numerator and denominator; value null with a reason when not computable. */
export interface Fraction {
  numerator: number;
  denominator: number;
  value: number | null;
  reason: string | null;
}

/** SME D9 measures of one standby asset over a window. */
export interface StandbyMetrics {
  demands: number;
  failedStarts: number;
  /** probability of failure on demand: failed starts / start demands (tests separate) */
  failureOnDemand: Fraction;
  tests: number;
  failedTests: number;
  testFailureFraction: Fraction;
  /** operating exposure: the asset's own running time in the window (seconds) */
  runningSeconds: number;
  failuresWhileRunning: number;
  /** running seconds / failures while running; null with exposure and 0 failures (never "infinite") */
  operatingMtbf: Fraction;
  /** registered standby time not running (seconds): exposure of dormant failures, never added to MTBF */
  standbySeconds: number;
}

const fraction = (
  numerator: number,
  denominator: number,
  none: string,
): Fraction => ({
  numerator,
  denominator,
  value: denominator > 0 ? numerator / denominator : null,
  reason: denominator > 0 ? null : none,
});

const overlapSeconds = (a: BoundedInterval, b: BoundedInterval) =>
  Math.max(
    0,
    (Math.min(a.end.getTime(), b.end.getTime()) -
      Math.max(a.start.getTime(), b.start.getTime())) /
      1000,
  );

const inWindow = (at: Date, window: BoundedInterval) =>
  at >= window.start && at < window.end;

/**
 * Standby measures (SME D9 worked example: 50 running hours, 20 start demands, 1 failed start → failure
 * on demand 1/20 = 5 %; 8,760 calendar hours over that failed start is not an operating MTBF). Demands and
 * tests count by start inside the window; running time is the overlap of runs with it (open runs to
 * `asOf`); a failure while running counts when its run ends inside the window.
 */
export function standbyMetrics(
  log: readonly StandbyLogEntry[],
  window: BoundedInterval,
  context: { asOf: Date; registered: readonly BoundedInterval[] },
): StandbyMetrics {
  const starts = (kind: 'demand' | 'test') =>
    log.filter((e) => e.kind === kind && inWindow(e.start, window));
  const demands = starts('demand');
  const tests = starts('test');
  const runs = log.filter((e) => e.kind === 'run');
  const runningSeconds = runs.reduce(
    (sum, run) =>
      sum +
      overlapSeconds(
        { start: run.start, end: run.end ?? context.asOf },
        window,
      ),
    0,
  );
  const failedRuns = runs.filter(
    (run) =>
      run.outcome === 'failed_while_running' &&
      run.end !== null &&
      inWindow(run.end, window),
  ).length;
  const failedStarts = demands.filter(
    (d) => d.outcome === 'failed_start',
  ).length;
  const failedTests = tests.filter((d) => d.outcome === 'failed_start').length;
  const registeredSeconds = context.registered.reduce(
    (sum, span) => sum + overlapSeconds(span, window),
    0,
  );
  return {
    demands: demands.length,
    failedStarts,
    failureOnDemand: fraction(failedStarts, demands.length, 'no_demands'),
    tests: tests.length,
    failedTests,
    testFailureFraction: fraction(failedTests, tests.length, 'no_tests'),
    runningSeconds,
    failuresWhileRunning: failedRuns,
    operatingMtbf: fraction(
      runningSeconds,
      failedRuns,
      runningSeconds > 0 ? 'no_failures' : 'no_running_exposure',
    ),
    standbySeconds: Math.max(0, registeredSeconds - runningSeconds),
  };
}
