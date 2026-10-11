/**
 * Product campaigns of a showcase unit: every calendar month is split into one campaign per product of the
 * unit (whole operational days, order rotating month by month), so a month plan names each product once
 * and an operational day always runs one product. Plans, outputs and valuation read the same table.
 */
import { UnitSpec } from './catalog-plants';
import { HOLIDAY } from './seed-calendar';
import {
  DAY_MS,
  DAY_START_HOUR,
  HOUR_MS,
  monthStart,
  nextMonthStart,
} from './showcase-window';

export interface Campaign {
  productCode: string;
  /** operational-day aligned (06:00 UTC) */
  from: number;
  to: number;
}

/** Operational-day starts (06:00) inside a calendar month: the first is the 1st at 06:00. */
function monthDays(month: number): number[] {
  const days: number[] = [];
  const end = nextMonthStart(month);
  for (
    let day = month + DAY_START_HOUR * HOUR_MS;
    day < end + DAY_START_HOUR * HOUR_MS;
    day += DAY_MS
  ) {
    days.push(day);
  }
  return days;
}

/** The campaigns of the calendar month that contains `ms`. */
export function monthCampaigns(unit: UnitSpec, ms: number): Campaign[] {
  const month = monthStart(ms);
  const days = monthDays(month);
  const count = unit.products.length;
  const rotation = new Date(month).getUTCMonth() % count;
  const size = Math.ceil(days.length / count);
  const campaigns: Campaign[] = [];
  for (let i = 0; i < count; i += 1) {
    const first = days[i * size];
    if (first === undefined) break;
    const lastIndex = Math.min((i + 1) * size, days.length) - 1;
    campaigns.push({
      productCode: unit.products[(i + rotation) % count],
      from: first,
      to: days[lastIndex] + DAY_MS,
    });
  }
  return campaigns;
}

/** Campaigns clipped to `[from, to)` (several months when the window spans them). */
export function campaignsIn(
  unit: UnitSpec,
  from: number,
  to: number,
): Campaign[] {
  const result: Campaign[] = [];
  for (
    let month = monthStart(from - DAY_MS);
    month < to;
    month = nextMonthStart(month)
  ) {
    for (const c of monthCampaigns(unit, month)) {
      const start = Math.max(c.from, from);
      const end = Math.min(c.to, to);
      if (start < end) result.push({ ...c, from: start, to: end });
    }
  }
  return result;
}

/** Scheduled hours of `[from, to)`: everything except the public holiday's operational day. */
export function scheduledHours(from: number, to: number): number {
  const holidayStart =
    Date.parse(`${HOLIDAY.date}T00:00:00Z`) + DAY_START_HOUR * HOUR_MS;
  const overlap = Math.max(
    0,
    Math.min(to, holidayStart + DAY_MS) - Math.max(from, holidayStart),
  );
  return (to - from - overlap) / HOUR_MS;
}

export function isHoliday(ms: number): boolean {
  return new Date(ms).toISOString().slice(0, 10) === HOLIDAY.date;
}
