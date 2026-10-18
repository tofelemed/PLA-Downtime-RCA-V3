/** Server flags of a residual beyond tolerance (plan 2.5 / 2.8). */
const ABOVE_TOLERANCE_FLAGS = new Set(['unaccounted', 'over_accounted', 'conflict']);
const WITHIN_TOLERANCE_FLAGS = new Set(['within_tolerance', 'balanced']);

export type ResidualTone = 'ok' | 'warning' | 'unknown';

export interface ResidualState {
  label: string;
  tone: ResidualTone;
}

/**
 * The words for the Unaccounted (residual) figure of a slice, read from the server's flags — nothing is
 * compared in the browser. A blocking flag wins over a within-tolerance flag; no known flag → null.
 */
export function residualStateOf(flags: readonly string[]): ResidualState | null {
  if (flags.some((flag) => ABOVE_TOLERANCE_FLAGS.has(flag))) return { label: 'Above tolerance', tone: 'warning' };
  if (flags.some((flag) => WITHIN_TOLERANCE_FLAGS.has(flag))) return { label: 'Within tolerance', tone: 'ok' };
  if (flags.includes('not_computable')) return { label: 'Not computable', tone: 'unknown' };
  return null;
}
