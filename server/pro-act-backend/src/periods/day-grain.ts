/** A 23 h floor: an operational day across a daylight-saving change is 23 h or 25 h long. */
const MIN_DAY_MS = 23 * 60 * 60 * 1000;

/**
 * True when a period spans its whole operational day (the daily accounting grain, one period per day);
 * a shift period is shorter. Read from the period's own window, so historic shift periods keep their grain.
 */
export function spansOperationalDay(utcStart: Date, utcEnd: Date): boolean {
  return utcEnd.getTime() - utcStart.getTime() >= MIN_DAY_MS;
}
