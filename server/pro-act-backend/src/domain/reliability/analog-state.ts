/**
 * Plan 1.10 / DT01 analog state mapping: a unit's state from an analog signal (throughput, motor current,
 * feed rate) by thresholds with hysteresis bands (a Schmitt trigger, so a value hovering at a threshold
 * does not flap). Three bands: stopped (value < `stopBelow`), reduced rate (`stopBelow` ≤ value <
 * `reducedBelow`) and running. A band is entered when the value falls below its threshold and left only
 * when the value rises above the threshold + `hysteresis`. Debounce and restart confirmation then apply to
 * the timeline as for discrete states (`derived-stops.ts`, `derived-slowdowns.ts`).
 */

/** The band an analog value puts the unit in. */
export type AnalogBand = 'stopped' | 'reduced_rate' | 'running';

/** Unit physical states an analog stop may map to (SME D1 stop states). */
export const ANALOG_STOP_STATES = [
  'internal_stop',
  'starved',
  'blocked',
] as const;
export type AnalogStopState = (typeof ANALOG_STOP_STATES)[number];

export interface AnalogThresholds {
  /** below this value the unit is stopped */
  stopBelow: number;
  /** below this value (and not stopped) the unit runs at a reduced rate; null = no reduced-rate band */
  reducedBelow: number | null;
  /** a lower band is left only above its threshold + this (signal units, ≥ 0) */
  hysteresis: number;
  /** the stop state an analog stop maps to (default internal stop: the signal does not tell the cause) */
  stopState: AnalogStopState;
  /** signal value at the full rate: a slowdown's fraction lost = 1 − mean / rated; null = not quantified */
  ratedValue: number | null;
}

const ORDER: Readonly<Record<AnalogBand, number>> = {
  stopped: 0,
  reduced_rate: 1,
  running: 2,
};

/** The band of a value without history (first sample, or after unknown time): plain thresholds. */
function plainBand(value: number, t: AnalogThresholds): AnalogBand {
  if (value < t.stopBelow) return 'stopped';
  if (t.reducedBelow !== null && value < t.reducedBelow) return 'reduced_rate';
  return 'running';
}

/** Upper threshold of a band: leaving it upwards needs a value at or above this + hysteresis. */
function upperOf(band: AnalogBand, t: AnalogThresholds): number | null {
  if (band === 'stopped') return t.stopBelow;
  if (band === 'reduced_rate') return t.reducedBelow;
  return null;
}

/**
 * The band of `value` given the band the unit was in: a lower band is entered at once (the debounce of
 * the timeline filters chatter); a higher band only once the value clears the current band's threshold
 * by the hysteresis, and then the band the value reaches — itself held below its own threshold +
 * hysteresis only when it is the band being left. Pure.
 */
export function analogBand(
  value: number,
  thresholds: AnalogThresholds,
  previous: AnalogBand | null,
): AnalogBand {
  const plain = plainBand(value, thresholds);
  if (previous === null || ORDER[plain] <= ORDER[previous]) return plain;
  const upper = upperOf(previous, thresholds);
  if (upper === null || value >= upper + thresholds.hysteresis) return plain;
  return previous;
}

/** A numeric sample value (state signals carry text); null when it is not a finite number. */
export function analogValue(text: string | null): number | null {
  if (text === null || text.trim() === '') return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}
