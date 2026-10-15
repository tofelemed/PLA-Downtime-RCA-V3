import { useEffect, useState } from 'react';
import { nextPlantDayUtc, startOfPlantDayUtc, utcToPlantLocal } from '@/lib/dates';
import type { InstantRange } from '@/features/ux-kit/date-inputs';

const DAY_MS = 86_400_000;

/** The last `days` plant days up to and including today, as a half-open UTC range. */
export function lastPlantDays(days: number, timeZone: string, now: Date = new Date()): InstantRange {
  const today = utcToPlantLocal(now.toISOString(), timeZone).slice(0, 10);
  const first = utcToPlantLocal(new Date(now.getTime() - (days - 1) * DAY_MS).toISOString(), timeZone).slice(0, 10);
  return { from: startOfPlantDayUtc(first, timeZone), to: nextPlantDayUtc(today, timeZone) };
}

/** A chosen analysis window (default the last `days` plant days); re-based when the plant zone loads. */
export function usePlantWindow(days: number, timeZone: string) {
  const [range, setRange] = useState<InstantRange>(() => lastPlantDays(days, timeZone));
  useEffect(() => setRange(lastPlantDays(days, timeZone)), [days, timeZone]);
  const window = range.from && range.to ? { from: range.from, to: range.to } : null;
  return { range, setRange, window };
}
