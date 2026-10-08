import {
  CalendarDefinition,
  CalendarDefinitionError,
  ShiftTemplate,
  WorkingInterval,
} from './calendar.types';
import { isValidTimeZone } from './zone-timeline';
import {
  isLocalDate,
  isLocalTime,
  msOfTime,
  MS_PER_DAY,
  wallOfDate,
} from './wall-clock';

/** Instants of an exclusion must carry an offset so they never depend on the server's zone. */
const INSTANT_WITH_OFFSET =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Refuses a definition the generator would have to guess about (422 at the API): unknown zone,
 * malformed times, duplicate shift names or holiday dates, empty or inverted exclusions.
 * Overlapping shifts are found when instances are generated (`OVERLAPPING_SHIFTS`).
 */
export function assertCalendarDefinition(definition: CalendarDefinition): void {
  if (!isValidTimeZone(definition.timezone)) {
    fail('INVALID_TIMEZONE', `${definition.timezone} is not an IANA time zone`);
  }
  assertTime(definition.operationalDayStart, 'operationalDayStart');
  if (definition.shiftTemplates.length === 0) {
    fail('NO_SHIFT_TEMPLATES', 'a calendar needs at least one shift template');
  }
  assertUnique(
    definition.shiftTemplates.map((t) => t.name),
    'DUPLICATE_SHIFT_NAME',
  );
  definition.shiftTemplates.forEach((t) => assertPeriod(t, `shift ${t.name}`));
  definition.workingIntervals.forEach((w) =>
    assertPeriod(w, 'working interval'),
  );
  for (const holiday of definition.holidays) {
    if (!isLocalDate(holiday.date)) {
      fail('INVALID_HOLIDAY', `holiday date ${holiday.date} is not a date`);
    }
  }
  assertUnique(
    definition.holidays.map((h) => h.date),
    'DUPLICATE_HOLIDAY',
  );
  for (const exclusion of definition.exclusions) {
    const valid =
      INSTANT_WITH_OFFSET.test(exclusion.from) &&
      INSTANT_WITH_OFFSET.test(exclusion.to) &&
      Date.parse(exclusion.from) < Date.parse(exclusion.to);
    if (!valid) {
      fail(
        'INVALID_EXCLUSION',
        'exclusions need from < to as ISO 8601 instants with an offset',
      );
    }
  }
}

/** Effective dates: `from` inclusive, `to` exclusive and after `from` when given. */
export function assertEffectiveDates(from: string, to: string | null): void {
  if (!isLocalDate(from) || (to !== null && !isLocalDate(to))) {
    fail('INVALID_EFFECTIVE_DATES', 'effective dates must be YYYY-MM-DD');
  }
  if (to !== null && wallOfDate(to) <= wallOfDate(from)) {
    fail('INVALID_EFFECTIVE_DATES', 'effectiveTo must be after effectiveFrom');
  }
}

/**
 * Wall-clock interval of a template (or working interval) on operational date `date`: a start before
 * the operational day start belongs to the next calendar day; an end at or before the start crosses
 * midnight (equal = 24 h).
 */
export function wallIntervalOn(
  period: ShiftTemplate | WorkingInterval,
  date: string,
  dayStartMs: number,
): [number, number] {
  const startMs = msOfTime(period.startLocal);
  const endMs = msOfTime(period.endLocal);
  const day = wallOfDate(date) + (startMs < dayStartMs ? MS_PER_DAY : 0);
  const end = day + endMs + (endMs <= startMs ? MS_PER_DAY : 0);
  return [day + startMs, end];
}

/** Whether a template applies on the operational date of ISO weekday `weekday`. */
export function appliesOn(
  period: ShiftTemplate | WorkingInterval,
  weekday: number,
): boolean {
  return !period.daysOfWeek?.length || period.daysOfWeek.includes(weekday);
}

function assertPeriod(
  period: ShiftTemplate | WorkingInterval,
  label: string,
): void {
  assertTime(period.startLocal, `${label} startLocal`);
  assertTime(period.endLocal, `${label} endLocal`);
  const days = period.daysOfWeek ?? [];
  if (days.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) {
    fail('INVALID_DAYS_OF_WEEK', `${label}: daysOfWeek are 1 (Monday) … 7`);
  }
}

function assertTime(value: string, label: string): void {
  if (!isLocalTime(value)) fail('INVALID_LOCAL_TIME', `${label} must be HH:mm`);
}

function assertUnique(values: string[], code: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) fail(code, `${value} appears twice`);
    seen.add(value);
  }
}

function fail(code: string, message: string): never {
  throw new CalendarDefinitionError(code, message);
}
