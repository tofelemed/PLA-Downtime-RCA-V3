import { EngineSample, EngineSignal, TimeWindow } from './actuals.types';
import { Dec, toDec } from './decimal';

/** A usable counter reading (epoch ms). */
export interface Reading {
  at: number;
  value: Dec;
}

/**
 * A point of the counter path inside the window: a reading, a step-held boundary value or a linearly
 * interpolated boundary value. `firstReading`/`lastReading` are the times of the readings it is derived
 * from, so gaps are measured between real readings.
 */
export interface CounterPoint {
  at: number;
  value: Dec;
  estimated: boolean;
  firstReading: number;
  lastReading: number;
}

/** Readings the quality policy allows (good; uncertain only when accepted), ordered by time. */
export function usableReadings(
  samples: EngineSample[],
  signal: EngineSignal,
): Reading[] {
  const readings: Reading[] = [];
  for (const sample of samples) {
    const usable =
      sample.quality === 'good' ||
      (sample.quality === 'uncertain' && signal.acceptUncertain === true);
    const value = usable ? toDec(sample.value) : null;
    if (value) readings.push({ at: sample.at.getTime(), value });
  }
  return readings.sort((a, b) => a.at - b.at);
}

/** Boundary values plus every reading strictly inside the window, in time order. */
export function counterPoints(
  readings: Reading[],
  signal: EngineSignal,
  window: TimeWindow,
): CounterPoint[] {
  const from = window.from.getTime();
  const to = window.to.getTime();
  const start = boundaryPoint(readings, from, signal);
  const end = boundaryPoint(readings, to, signal);
  const inside = readings
    .filter((reading) => reading.at > from && reading.at < to)
    .map(readingPoint);
  return [...(start ? [start] : []), ...inside, ...(end ? [end] : [])];
}

/**
 * The counter value at instant `t`: the reading at `t`; else, by the signal's interpolation, the last
 * reading before `t` held (step) or the value between the neighbouring readings (linear, only when the
 * signal is configured linear and nothing dropped in between). Null when no credible value exists
 * within `maxGapSeconds`.
 */
export function boundaryPoint(
  readings: Reading[],
  t: number,
  signal: EngineSignal,
): CounterPoint | null {
  const exact = readings.find((reading) => reading.at === t);
  if (exact) return readingPoint(exact);
  const before = lastBefore(readings, t);
  const after = readings.find((reading) => reading.at > t);
  const maxGapMs = signal.maxGapSeconds * 1000;
  if (signal.interpolation === 'step') {
    if (!before || t - before.at > maxGapMs) return null;
    return { ...readingPoint(before), at: t };
  }
  if (!before || !after || after.at - before.at > maxGapMs) return null;
  if (after.value.lt(before.value)) return null;
  const fraction = new Dec(t - before.at).div(after.at - before.at);
  return {
    at: t,
    value: before.value.plus(after.value.minus(before.value).mul(fraction)),
    estimated: true,
    firstReading: before.at,
    lastReading: after.at,
  };
}

function lastBefore(readings: Reading[], t: number): Reading | undefined {
  let found: Reading | undefined;
  for (const reading of readings) {
    if (reading.at >= t) break;
    found = reading;
  }
  return found;
}

function readingPoint(reading: Reading): CounterPoint {
  return {
    at: reading.at,
    value: reading.value,
    estimated: false,
    firstReading: reading.at,
    lastReading: reading.at,
  };
}
