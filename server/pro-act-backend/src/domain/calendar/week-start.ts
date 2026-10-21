/**
 * First day of a plant's reporting week (DT-10), configurable to any day (owner 21 Oct 2026). Listed in
 * ISO weekday order: index + 1 is the ISO day number (Monday 1 … Sunday 7).
 */
export const WEEK_STARTS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;
export type WeekStart = (typeof WEEK_STARTS)[number];

/** ISO day number of a week start (Monday 1 … Sunday 7). */
export function isoDayOf(weekStart: WeekStart): number {
  return WEEK_STARTS.indexOf(weekStart) + 1;
}

const DAY_MS = 86_400_000;

/**
 * Week start of a new plant when none is given (owner decision 13 Oct 2026): Iranian plants — time zone
 * Asia/Tehran or the Persian calendar — start on Saturday (the weekend is Thursday–Friday); every other
 * plant uses the ISO 8601 Monday week.
 */
export function defaultWeekStart(
  timezone: string | null | undefined,
  calendarSystem: string | null | undefined,
): WeekStart {
  return timezone === 'Asia/Tehran' || calendarSystem === 'persian'
    ? 'saturday'
    : 'monday';
}

/** ISO 8601 week of an operational date (`YYYY-"W"WW`, the same key as the SQL `IYYY-"W"IW`). */
export function isoWeek(localDate: string): string {
  const date = new Date(`${localDate}T00:00:00Z`);
  const weekday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - weekday + 3);
  const year = date.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(year, 0, 4));
  const firstWeekday = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstWeekday + 3);
  const week =
    1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * DAY_MS));
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/**
 * Week bucket of an operational date: the ISO key for Monday weeks; for a week starting on any other day the
 * date of the week's first day (`YYYY-MM-DD`) — such weeks have no ISO number, so the start date names them.
 */
export function weekKey(localDate: string, weekStart: WeekStart): string {
  if (weekStart === 'monday') return isoWeek(localDate);
  const date = new Date(`${localDate}T00:00:00Z`);
  const isoDay = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  const sinceStart = (isoDay - isoDayOf(weekStart) + 7) % 7;
  return new Date(date.getTime() - sinceStart * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

const WEEK_STARTS_SQL = `ARRAY[${WEEK_STARTS.map((day) => `'${day}'`).join(', ')}]`;

/**
 * The same week key in SQL over a `date` expression; `weekStartSql` yields one of `WEEK_STARTS`
 * (isodow: Monday 1 … Sunday 7; the start's ISO day is its position in the array).
 */
export function weekKeySql(dateSql: string, weekStartSql: string): string {
  return `CASE WHEN ${weekStartSql} = 'monday'
    THEN to_char(date_trunc('week', ${dateSql}), 'IYYY-"W"IW')
    ELSE to_char(${dateSql} - ((extract(isodow FROM ${dateSql})::int
      - array_position(${WEEK_STARTS_SQL}::text[], (${weekStartSql})::text) + 7) % 7), 'YYYY-MM-DD') END`;
}
