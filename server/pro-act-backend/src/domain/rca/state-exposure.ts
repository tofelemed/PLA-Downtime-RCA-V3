import { StateSegment } from '../reliability/unit-state';
import {
  BoundedInterval,
  clip,
  union,
  unionSeconds,
} from '../time/interval-algebra';

/**
 * CA2 / SME D2 known run time of an effectiveness window (rca-exposure-v3): the time the state timeline
 * of every case unit shows running or reduced rate, minus recorded downtime, and the known-data coverage.
 * Unknown time (no data, stale, bad quality, unmapped, no state mapping) is never run time.
 */
export interface StateExposure {
  windowSeconds: number;
  /** known running (reduced rate included) of every unit, recorded downtime removed */
  runningSeconds: number;
  /** known state (running or stopped) of every unit */
  knownSeconds: number;
  unknownSeconds: number;
  /** known / window; null for an empty window */
  coverage: number | null;
}

const RUNNING: ReadonlySet<string> = new Set(['running', 'reduced_rate']);

/** Intersection of two merged, sorted interval lists. */
export function intersect(
  a: readonly BoundedInterval[],
  b: readonly BoundedInterval[],
): BoundedInterval[] {
  const left = union(a);
  const right = union(b);
  const result: BoundedInterval[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    const part = clip(left[i], right[j]);
    if (part) result.push(part);
    if (left[i].end.getTime() < right[j].end.getTime()) i += 1;
    else j += 1;
  }
  return result;
}

/** `from` minus every interval of `cut`. */
export function subtract(
  from: readonly BoundedInterval[],
  cut: readonly BoundedInterval[],
): BoundedInterval[] {
  const cuts = union(cut);
  const result: BoundedInterval[] = [];
  for (const span of union(from)) {
    let cursor = span.start.getTime();
    const end = span.end.getTime();
    for (const c of cuts) {
      if (c.end.getTime() <= cursor || c.start.getTime() >= end) continue;
      if (c.start.getTime() > cursor)
        result.push({ start: new Date(cursor), end: c.start });
      cursor = Math.max(cursor, c.end.getTime());
    }
    if (cursor < end) result.push({ start: new Date(cursor), end: span.end });
  }
  return result;
}

const spansOf = (
  segments: readonly StateSegment[],
  keep: (state: string) => boolean,
  window: BoundedInterval,
): BoundedInterval[] =>
  union(
    segments.flatMap((s) => {
      const part = keep(s.state) ? clip(s, window) : null;
      return part ? [part] : [];
    }),
  );

/**
 * Known run time of the window over the case's units (each unit's timeline; an empty list = no state
 * data). With several units the case is exposed while all of them run, as before (window minus the union
 * of their downtime); the window is known only where every unit's state is known.
 */
export function stateExposureOf(
  units: ReadonlyArray<readonly StateSegment[]>,
  downtime: readonly BoundedInterval[],
  window: BoundedInterval,
): StateExposure {
  const windowSeconds = Math.max(
    0,
    (window.end.getTime() - window.start.getTime()) / 1000,
  );
  let running: BoundedInterval[] = units.length > 0 ? [window] : [];
  let known: BoundedInterval[] = units.length > 0 ? [window] : [];
  for (const segments of units) {
    running = intersect(
      running,
      spansOf(segments, (state) => RUNNING.has(state), window),
    );
    known = intersect(
      known,
      spansOf(segments, (state) => state !== 'unknown', window),
    );
  }
  const knownSeconds = unionSeconds(known);
  return {
    windowSeconds,
    runningSeconds: unionSeconds(subtract(running, downtime)),
    knownSeconds,
    unknownSeconds: Math.max(0, windowSeconds - knownSeconds),
    coverage: windowSeconds > 0 ? knownSeconds / windowSeconds : null,
  };
}
