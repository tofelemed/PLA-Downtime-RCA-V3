import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { nextPlantDayUtc, startOfPlantDayUtc, utcToPlantLocal } from '@/lib/dates';
import type { InstantRange } from '@/features/ux-kit/date-inputs';

const DAY_MS = 86_400_000;

/** The last `days` plant days up to and including today, as a half-open UTC range. */
export function lastPlantDays(days: number, timeZone: string, now: Date = new Date()): InstantRange {
  const today = utcToPlantLocal(now.toISOString(), timeZone).slice(0, 10);
  const first = utcToPlantLocal(new Date(now.getTime() - (days - 1) * DAY_MS).toISOString(), timeZone).slice(0, 10);
  return { from: startOfPlantDayUtc(first, timeZone), to: nextPlantDayUtc(today, timeZone) };
}

const isInstant = (value: string | null): value is string => value !== null && !Number.isNaN(Date.parse(value));

/** The window named in the address (`from` / `to`, ISO instants), or null when absent or not ordered. */
export function windowFromParams(params: URLSearchParams): InstantRange | null {
  const from = params.get('from');
  const to = params.get('to');
  if (!isInstant(from) || !isInstant(to) || Date.parse(to) <= Date.parse(from)) return null;
  return { from, to };
}

/**
 * A chosen analysis window (default the last `days` plant days); re-based when the plant zone loads.
 * With `inUrl` the chosen window lives in the address (`from` / `to`, QA L11), so reload and links keep it.
 */
export function usePlantWindow(days: number, timeZone: string, inUrl = false) {
  const [params, setParams] = useSearchParams();
  const fromUrl = inUrl ? windowFromParams(params) : null;
  const [local, setLocal] = useState<InstantRange>(() => lastPlantDays(days, timeZone));
  useEffect(() => setLocal(lastPlantDays(days, timeZone)), [days, timeZone]);
  const range = fromUrl ?? local;
  const setRange = (next: InstantRange) => {
    setLocal(next);
    if (!inUrl) return;
    setParams((current) => {
      const updated = new URLSearchParams(current);
      if (next.from && next.to) {
        updated.set('from', next.from);
        updated.set('to', next.to);
      } else {
        updated.delete('from');
        updated.delete('to');
      }
      return updated;
    }, { replace: true });
  };
  const window = range.from && range.to ? { from: range.from, to: range.to } : null;
  return { range, setRange, window };
}
