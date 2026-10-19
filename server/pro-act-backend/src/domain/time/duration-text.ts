const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_FROM_HOURS = 48;

function days(totalHours: number): string {
  const wholeDays = Math.floor(totalHours / HOURS_PER_DAY);
  const hours = totalHours % HOURS_PER_DAY;
  return hours === 0 ? `${wholeDays} d` : `${wholeDays} d ${hours} h`;
}

/**
 * A duration in seconds as the screens show it (the frontend `formatDuration`, UX audit C-3): under a
 * minute "45 s", under 1 h "42 min", up to 48 h "17 h 03 min", beyond "2 d 11 h". Used in server
 * detail text such as the equipment readiness checks (QA M6), never in figures.
 */
export function durationText(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < MINUTES_PER_HOUR) return `${totalMinutes} min`;
  if (totalMinutes > DAYS_FROM_HOURS * MINUTES_PER_HOUR)
    return days(Math.round(totalMinutes / MINUTES_PER_HOUR));
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const minutes = totalMinutes % MINUTES_PER_HOUR;
  return minutes === 0
    ? `${hours} h`
    : `${hours} h ${String(minutes).padStart(2, '0')} min`;
}
