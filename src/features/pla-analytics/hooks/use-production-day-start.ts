import { useSites } from '@/api/v2/queries/reference-data';

/** Calendar days when the plant has no site record yet (never an invented 06:00). */
export const CALENDAR_DAY_START = '00:00';

export interface ProductionDayStart {
  /** `HH:mm` on the plant clock where the production day starts (the default site's operational day start) */
  dayStart: string;
  loading: boolean;
}

/**
 * The plant's production-day start (owner decision 2026-10-19 "Production-day boundaries"): date-only picks
 * and day labels use it, never midnight or the current clock time. Same site as the plant timezone (D03).
 */
export function useProductionDayStart(): ProductionDayStart {
  const sites = useSites();
  const items = sites.data?.items;
  const site = items?.find((entry) => entry.isDefault) ?? items?.[0];
  const start = site?.operationalDayStart?.slice(0, 5);
  return { dayStart: start && /^\d{2}:\d{2}$/.test(start) ? start : CALENDAR_DAY_START, loading: sites.isLoading };
}
