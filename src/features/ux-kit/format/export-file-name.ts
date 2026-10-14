import { utcToPlantLocal } from '@/lib/dates';

/** Product prefix of downloaded exports (user-visible file names). */
export const EXPORT_FILE_PREFIX = 'traverse-forge';

/**
 * The plant day of an instant for a file name: `YYYY-MM-DD` on the plant clock (not the UTC day, which
 * is the previous day for a window starting at plant midnight east of Greenwich). File names stay ISO /
 * Latin digits whatever the calendar setting, so they sort; `fallback` when the instant is missing.
 */
export function plantFileDay(iso: string | null | undefined, timezone: string, fallback = 'all'): string {
  if (!iso) return fallback;
  const local = utcToPlantLocal(iso, timezone);
  return local ? local.slice(0, 10) : fallback;
}

/** `traverse-forge-<part>-<part>.csv` from the non-empty parts. */
export function exportFileName(parts: ReadonlyArray<string | null | undefined>, extension = 'csv'): string {
  return `${[EXPORT_FILE_PREFIX, ...parts.filter((part): part is string => Boolean(part))].join('-')}.${extension}`;
}
