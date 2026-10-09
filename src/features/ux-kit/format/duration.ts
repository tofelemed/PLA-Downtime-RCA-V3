/**
 * The one place durations are turned into text (plan 3.1, decision C1): the API speaks seconds; lists
 * show minutes (`compact`), KPI tiles h:mm (`clock`), detail text hours and minutes (`long`).
 */
export type DurationStyle = 'long' | 'compact' | 'clock';

export const NO_VALUE = '—';

/** Seconds from a number or an API decimal string; null when absent or not a finite value ≥ 0. */
export function toSeconds(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const seconds = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

function long(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

function compact(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} s`;
  return `${Math.round(seconds / 60).toLocaleString('en-US')} min`;
}

function clock(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  return `${hours}:${String(totalMinutes % 60).padStart(2, '0')}`;
}

/** `5400` → "1 h 30 min" (long), "90 min" (compact), "1:30" (clock); invalid → "—". */
export function formatDuration(value: number | string | null | undefined, style: DurationStyle = 'long'): string {
  const seconds = toSeconds(value);
  if (seconds === null) return NO_VALUE;
  if (style === 'compact') return compact(seconds);
  if (style === 'clock') return clock(seconds);
  return long(seconds);
}
