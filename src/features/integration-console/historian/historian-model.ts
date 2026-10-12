import type { SignalPreviewView } from '@/api/v2/types/integration-mappings';

export type SignalSample = SignalPreviewView['samples'][number];

/** At most this many signals share one trend (readable legend and bounded requests). */
export const MAX_TREND_SIGNALS = 5;
/** The server previews at most 31 days per request. */
export const MAX_TREND_DAYS = 31;
/** Points drawn per series; the table and the export always carry every sample. */
export const MAX_DRAWN_POINTS = 2000;

export interface TrendPoint {
  t: number;
  value: number;
}

const toNumber = (value: string | null): number | null => {
  if (value === null || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Numeric samples inside the window as chart points, thinned by a fixed stride when there are more
 * than `max` (display only: no value is computed, each drawn point is a stored sample).
 */
export function trendPoints(samples: readonly SignalSample[], max = MAX_DRAWN_POINTS): TrendPoint[] {
  const points: TrendPoint[] = [];
  for (const sample of samples) {
    const value = toNumber(sample.value);
    if (sample.inWindow && value !== null) points.push({ t: Date.parse(sample.observedAt), value });
  }
  if (points.length <= max) return points;
  const stride = Math.ceil(points.length / max);
  const thinned: TrendPoint[] = [];
  for (let index = 0; index < points.length; index += stride) thinned.push(points[index]);
  const last = points[points.length - 1];
  if (thinned[thinned.length - 1] !== last) thinned.push(last);
  return thinned;
}

/** A sample's display value: the stored decimal without trailing zeros, or the state name, or "—". */
export function sampleValue(sample: SignalSample): string {
  if (sample.value === null) return sample.stateName ?? '—';
  return /^-?\d+\.\d+$/.test(sample.value) ? sample.value.replace(/\.?0+$/, '') : sample.value;
}

const csvCell = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

/** CSV of the samples in the window (ISO UTC times, values as stored) for one or more signals. */
export function samplesCsv(series: ReadonlyArray<{ name: string; samples: readonly SignalSample[] }>): string {
  const lines = ['signal,observed_at_utc,value,state,quality,revisions'];
  for (const entry of series) {
    for (const sample of entry.samples) {
      if (!sample.inWindow) continue;
      lines.push([entry.name, sample.observedAt, sample.value ?? '', sample.stateName ?? '', sample.quality, String(sample.revisions)].map(csvCell).join(','));
    }
  }
  return `${lines.join('\n')}\n`;
}

/** True when the period is longer than the server previews in one request. */
export function tooLong(from: string | null, to: string | null): boolean {
  if (!from || !to) return false;
  return Date.parse(to) - Date.parse(from) > MAX_TREND_DAYS * 86_400_000;
}
