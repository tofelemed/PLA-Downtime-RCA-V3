import { BoundedInterval } from '../time/interval-algebra';
import { StateSegment } from './unit-state';

/** Known-data coverage and availability bounds over the scheduled time (SME D2). */
export interface StateCoverage {
  scheduledSeconds: number;
  runningSeconds: number;
  /** known not running: every known state but running (starved / blocked stay in the unit's availability, D3) */
  knownStoppedSeconds: number;
  unknownSeconds: number;
  /** (running + known stopped) / scheduled; null without scheduled time */
  coverage: number | null;
  /** running / scheduled: every unknown second counted as stopped */
  availabilityLower: number | null;
  /** (running + unknown) / scheduled: every unknown second counted as running */
  availabilityUpper: number | null;
  /** running / known time: conditional on observed time only, never the certified availability */
  knownTimeAvailability: number | null;
  secondsByState: Record<string, number>;
}

const overlapSeconds = (a: BoundedInterval, b: BoundedInterval) =>
  Math.max(
    0,
    (Math.min(a.end.getTime(), b.end.getTime()) -
      Math.max(a.start.getTime(), b.start.getTime())) /
      1000,
  );

const ratio = (n: number, d: number) => (d > 0 ? n / d : null);

/**
 * Coverage and availability bounds of a unit (SME D2 worked example: 8 h scheduled, 6 h known running,
 * 1 h known stopped, 1 h unknown → availability between 75 % and 87.5 %, coverage 87.5 %, 85.7 % only on
 * observed time). The scheduled denominator is kept; unknown time is never deleted from it.
 */
export function stateCoverage(
  segments: readonly StateSegment[],
  scheduled: readonly BoundedInterval[],
): StateCoverage {
  const secondsByState: Record<string, number> = {};
  let scheduledSeconds = 0;
  for (const span of scheduled) {
    scheduledSeconds += (span.end.getTime() - span.start.getTime()) / 1000;
    for (const segment of segments) {
      const seconds = overlapSeconds(segment, span);
      if (seconds > 0) {
        secondsByState[segment.state] =
          (secondsByState[segment.state] ?? 0) + seconds;
      }
    }
  }
  const running = secondsByState.running ?? 0;
  const unknown = secondsByState.unknown ?? 0;
  const knownStopped = Object.entries(secondsByState)
    .filter(([state]) => state !== 'running' && state !== 'unknown')
    .reduce((sum, [, seconds]) => sum + seconds, 0);
  // time of the schedule the timeline does not reach is unknown too
  const missing = Math.max(
    0,
    scheduledSeconds - running - unknown - knownStopped,
  );
  const unknownSeconds = unknown + missing;
  return {
    scheduledSeconds,
    runningSeconds: running,
    knownStoppedSeconds: knownStopped,
    unknownSeconds,
    coverage: ratio(running + knownStopped, scheduledSeconds),
    availabilityLower: ratio(running, scheduledSeconds),
    availabilityUpper: ratio(running + unknownSeconds, scheduledSeconds),
    knownTimeAvailability: ratio(running, running + knownStopped),
    secondsByState:
      missing > 0
        ? { ...secondsByState, unknown: unknownSeconds }
        : secondsByState,
  };
}

/** Scheduled intervals of a window: the window minus excluded schedule spans (none when the period is excluded). */
export function scheduledIntervals(
  window: BoundedInterval,
  excluded: readonly BoundedInterval[],
  periodExcluded: boolean,
): BoundedInterval[] {
  if (periodExcluded) return [];
  const cuts = [...excluded].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );
  const result: BoundedInterval[] = [];
  let cursor = window.start;
  for (const cut of cuts) {
    if (cut.end <= cursor || cut.start >= window.end) continue;
    if (cut.start > cursor) result.push({ start: cursor, end: cut.start });
    cursor = cut.end > cursor ? cut.end : cursor;
  }
  if (cursor < window.end) result.push({ start: cursor, end: window.end });
  return result;
}
