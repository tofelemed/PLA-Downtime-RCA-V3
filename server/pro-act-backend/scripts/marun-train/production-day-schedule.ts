/**
 * Minute-by-minute measurements of the HDPE-TRAIN production day (guide lessons 12 and 16, DECISIONS
 * 2026-10-18 "Marun HDPE training plant"): state RUN/STOP and the cumulative tonne counter of Extruder1,
 * one observation per minute for both signals, including the exact shift and stop boundaries.
 *
 * Minutes count from the day start (17 Oct 2026 06:00 Asia/Tehran = 02:30Z). Intervals are half-open:
 * a STOP holds at its start minute and RUN is back at its end minute.
 *   Shift A  0–480    RUN 28 t/h, STOP [120, 180) gearbox, RUN 27.2 t/h   counter 1000 → 1192
 *   Shift B  480–960  RUN 28 t/h                                           counter 1192 → 1416
 *   Shift C  960–1440 RUN 28 t/h, STOP [1200, 1230) left uncoded           counter 1416 → 1626
 * Thirty lead-in minutes (05:30–06:00) make the state at 06:00 known; the counter reaches 1000 at 06:00.
 */
import { TIMES } from './train-catalog';

export const STATE_SIGNAL = 'EXT1-State';
export const COUNTER_SIGNAL = 'EXT1-Throughput';
export const LEAD_IN_MINUTES = 30;
export const DAY_MINUTES = 1440;

const MINUTE_MS = 60_000;

/** Counter segments: from minute (exclusive of the previous segment) with a start value and t/h rate. */
interface Segment {
  from: number;
  to: number;
  start: number;
  rate: number;
}

const SEGMENTS: readonly Segment[] = [
  { from: -LEAD_IN_MINUTES, to: 120, start: 1000, rate: 28 },
  { from: 120, to: 180, start: 1056, rate: 0 },
  { from: 180, to: 480, start: 1056, rate: 27.2 },
  { from: 480, to: 1200, start: 1192, rate: 28 },
  { from: 1200, to: 1230, start: 1528, rate: 0 },
  { from: 1230, to: DAY_MINUTES, start: 1528, rate: 28 },
];

/** Stops as half-open minute ranges [from, to). */
export const STOPS: ReadonlyArray<{ from: number; to: number }> = [
  { from: 120, to: 180 },
  { from: 1200, to: 1230 },
];

export interface Observation {
  minute: number;
  /** ISO instant, UTC */
  ts: string;
  state: 'RUN' | 'STOP';
  /** cumulative tonnes, rounded to 3 decimals (exact at every boundary) */
  counter: number;
}

export function stateAt(minute: number): 'RUN' | 'STOP' {
  return STOPS.some((stop) => minute >= stop.from && minute < stop.to)
    ? 'STOP'
    : 'RUN';
}

/** Counter value at a minute; segment start values are exact, so boundaries never drift. */
export function counterAt(minute: number): number {
  const segment = SEGMENTS.find(
    (s) => minute <= s.to && (minute > s.from || s.from === -LEAD_IN_MINUTES),
  );
  if (!segment) throw new Error(`minute ${minute} is outside the day`);
  const origin = segment.from === -LEAD_IN_MINUTES ? 0 : segment.from;
  const value = segment.start + (segment.rate * (minute - origin)) / 60;
  return Math.round(value * 1000) / 1000;
}

export function instantOf(minute: number): string {
  return new Date(
    Date.parse(TIMES.dayStart) + minute * MINUTE_MS,
  ).toISOString();
}

/** Every observation from 05:30 to 06:00 the next day inclusive (the end boundary sample). */
export function productionDay(): Observation[] {
  const rows: Observation[] = [];
  for (let m = -LEAD_IN_MINUTES; m <= DAY_MINUTES; m += 1) {
    rows.push({
      minute: m,
      ts: instantOf(m),
      state: stateAt(m),
      counter: counterAt(m),
    });
  }
  return rows;
}

/** Guide checkpoints the schedule must reproduce before anything is published. */
const CHECKPOINTS: ReadonlyArray<[number, 'RUN' | 'STOP', number]> = [
  [0, 'RUN', 1000],
  [60, 'RUN', 1028],
  [120, 'STOP', 1056],
  [150, 'STOP', 1056],
  [180, 'RUN', 1056],
  [240, 'RUN', 1083.2],
  [360, 'RUN', 1137.6],
  [480, 'RUN', 1192],
  [960, 'RUN', 1416],
  [1200, 'STOP', 1528],
  [1230, 'RUN', 1528],
  [DAY_MINUTES, 'RUN', 1626],
];

/** Throws when the schedule drifts from the guide (gross 192 / 224 / 210 t, stops 60 and 30 min). */
export function assertGuideCheckpoints(): void {
  for (const [minute, state, counter] of CHECKPOINTS) {
    if (stateAt(minute) !== state || counterAt(minute) !== counter) {
      throw new Error(
        `schedule drift at minute ${minute}: ${stateAt(minute)} ${counterAt(minute)}, guide ${state} ${counter}`,
      );
    }
  }
}
