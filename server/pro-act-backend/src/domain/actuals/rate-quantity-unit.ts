import { RateTimebase } from './actuals.types';

const TIMEBASES: Readonly<Record<string, RateTimebase>> = {
  s: 's',
  sec: 's',
  second: 's',
  min: 'min',
  minute: 'min',
  h: 'h',
  hr: 'h',
  hour: 'h',
  d: 'd',
  day: 'd',
};

/** Integration removes an explicit time denominator; no mass/volume conversion is inferred. */
export function rateQuantityUnit(
  uom: string | null | undefined,
  timebase: string | null | undefined,
): { uom: string | null; matches: boolean } {
  if (!uom) return { uom: null, matches: true };
  const parts = uom.trim().match(/^(.+?)\s*\/\s*([a-z]+)$/i);
  if (!parts || !TIMEBASES[parts[2].toLowerCase()])
    return { uom, matches: true };
  return {
    uom: parts[1].trim(),
    matches: TIMEBASES[parts[2].toLowerCase()] === timebase,
  };
}
