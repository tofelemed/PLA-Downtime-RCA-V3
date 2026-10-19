import { useSites } from '@/api/v2/queries/reference-data';

/** `HH:mm` of a stored time (`06:00:00` → `06:00`); null when it is not a time. */
export function dayStartText(value: string | null | undefined): string | null {
  const match = /^(\d{2}):(\d{2})/.exec(value ?? '');
  return match ? `${match[1]}:${match[2]}` : null;
}

/**
 * The plant's operational (production) day start on the plant clock, from the default site (the value
 * every calendar version starts from; 06:00 unless the plant changed it). Null while the sites load, so
 * a date-only window is never sent with a guessed boundary (QA re-test: production-day boundaries).
 */
export function useOperationalDayStart(): string | null {
  const sites = useSites();
  const items = sites.data?.items;
  if (!items) return sites.isError ? '00:00' : null;
  const site = items.find((entry) => entry.isDefault) ?? items[0];
  return dayStartText(site?.operationalDayStart) ?? '00:00';
}
