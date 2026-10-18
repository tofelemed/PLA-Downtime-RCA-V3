import { BoundedInterval } from '../time/interval-algebra';
import {
  appliesOn,
  assertCalendarDefinition,
  wallIntervalOn,
} from './calendar-definition';
import {
  CalendarDefinition,
  CalendarDefinitionError,
  CalendarWarning,
  GeneratedShift,
  GenerationResult,
  Holiday,
  ShiftTemplate,
} from './calendar.types';
import {
  complementWindows,
  ExclusionWindow,
  markWindows,
  shiftPiece,
} from './schedule-windows';
import {
  addDays,
  datesInRange,
  isoWeekday,
  msOfTime,
  MS_PER_DAY,
  wallOfDate,
} from './wall-clock';
import { ZoneTimeline } from './zone-timeline';

/** Operational dates `[from, to]` (inclusive) to generate. */
export interface LocalDateRange {
  from: string;
  to: string;
}

interface DayContext {
  definition: CalendarDefinition;
  timeline: ZoneTimeline;
  dayStartMs: number;
  warnings: CalendarWarning[];
}

/**
 * Shift instances of a calendar for operational dates `range` (spec CAL01/CAL02, plan 2.1 step 2).
 * Each template occurrence is mapped from plant-local wall time to UTC with the zone's real offsets:
 * a spring-forward gap shortens the shift, a fall-back hour lengthens it, and a boundary inside the
 * repeated hour yields two instances with different start offsets. A shift starting before the
 * operational day start belongs to the previous operational date (production date). Holidays marked
 * `excluded`, exclusions and time outside working intervals are excluded (split where partial).
 * Deterministic: the same definition and range always give the same instances.
 */
export function generateShifts(
  definition: CalendarDefinition,
  range: LocalDateRange,
): GenerationResult {
  assertCalendarDefinition(definition);
  const timeline = ZoneTimeline.forWallRange(
    definition.timezone,
    wallOfDate(range.from),
    wallOfDate(range.to) + 2 * MS_PER_DAY,
  );
  const context: DayContext = {
    definition,
    timeline,
    dayStartMs: msOfTime(definition.operationalDayStart),
    warnings: [],
  };
  const base = datesInRange(range.from, range.to).flatMap((date) =>
    shiftsOfDay(context, date),
  );
  const excluded = markWindows(base, exclusionWindows(definition), timeline);
  const instances = applyWorkingIntervals(context, excluded, range).sort(
    (a, b) => a.utcStart.getTime() - b.utcStart.getTime(),
  );
  assertNoOverlap(instances);
  return { instances, warnings: context.warnings };
}

/** 422 `OVERLAPPING_SHIFTS` when two instances share time (the table's exclusion constraint). */
export function assertNoOverlap(instances: readonly GeneratedShift[]): void {
  const sorted = [...instances].sort(
    (a, b) => a.utcStart.getTime() - b.utcStart.getTime(),
  );
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].utcStart < sorted[i - 1].utcEnd) {
      throw new CalendarDefinitionError(
        'OVERLAPPING_SHIFTS',
        `${sorted[i - 1].shiftName} (${sorted[i - 1].localStart}) overlaps ` +
          `${sorted[i].shiftName} (${sorted[i].localStart})`,
      );
    }
  }
}

function shiftsOfDay(context: DayContext, date: string): GeneratedShift[] {
  const { definition } = context;
  const holiday = definition.holidays.find((h) => h.date === date);
  if (holiday?.treatment === 'reduced' && !holiday.workingIntervals?.length) {
    context.warnings.push({
      code: 'holiday_reduced',
      localDate: date,
      shiftName: null,
      detail: holiday.name,
    });
  }
  const weekday = isoWeekday(date);
  const shifts = definition.shiftTemplates
    .filter((template) => appliesOn(template, weekday))
    .flatMap((template) =>
      templateOccurrence(context, template, date, holiday),
    );
  return applyHolidayWindows(context, shifts, date, holiday);
}

/** Keep the ordinary shifts, marking time outside explicitly entered holiday windows as excluded. */
function applyHolidayWindows(
  context: DayContext,
  shifts: GeneratedShift[],
  date: string,
  holiday: Holiday | undefined,
): GeneratedShift[] {
  if (
    holiday?.treatment !== 'reduced' ||
    !holiday.workingIntervals?.length ||
    !shifts.length
  )
    return shifts;
  const working = holiday.workingIntervals
    .filter((window) => appliesOn(window, isoWeekday(date)))
    .flatMap((window) => {
      const [start, end] = wallIntervalOn(window, date, context.dayStartMs);
      return context.timeline.preimage(start, end);
    });
  const span = {
    start: new Date(Math.min(...shifts.map((s) => s.utcStart.getTime()))),
    end: new Date(Math.max(...shifts.map((s) => s.utcEnd.getTime()))),
  };
  const gaps = complementWindows(working, span).map((gap) => ({
    ...gap,
    kind: 'holiday' as const,
    reason: holiday.name,
  }));
  return markWindows(shifts, gaps, context.timeline);
}

function templateOccurrence(
  context: DayContext,
  template: ShiftTemplate,
  date: string,
  holiday: Holiday | undefined,
): GeneratedShift[] {
  const [wallStart, wallEnd] = wallIntervalOn(
    template,
    date,
    context.dayStartMs,
  );
  const pieces = context.timeline.preimage(wallStart, wallEnd);
  noteDst(context, { date, name: template.name }, wallEnd - wallStart, pieces);
  const exclusion =
    holiday?.treatment === 'excluded'
      ? { kind: 'holiday' as const, reason: holiday.name }
      : null;
  const base = { localDate: date, shiftName: template.name, crewId: null };
  return pieces.map((piece) =>
    shiftPiece(context.timeline, base, piece, exclusion),
  );
}

function noteDst(
  context: DayContext,
  shift: { date: string; name: string },
  nominalMs: number,
  pieces: BoundedInterval[],
): void {
  const actualMs = pieces.reduce(
    (sum, p) => sum + p.end.getTime() - p.start.getTime(),
    0,
  );
  const note = (code: CalendarWarning['code']): void => {
    context.warnings.push({
      code,
      localDate: shift.date,
      shiftName: shift.name,
      nominalSeconds: nominalMs / 1000,
      actualSeconds: actualMs / 1000,
    });
  };
  if (actualMs < nominalMs) note('dst_gap');
  if (actualMs > nominalMs) note('dst_repeat');
  if (pieces.length > 1) note('dst_split');
}

function exclusionWindows(definition: CalendarDefinition): ExclusionWindow[] {
  return definition.exclusions.map((exclusion) => ({
    start: new Date(exclusion.from),
    end: new Date(exclusion.to),
    kind: exclusion.kind,
    reason: exclusion.reason,
  }));
}

/** With working intervals defined, shift time outside all of them is `non_working`. */
function applyWorkingIntervals(
  context: DayContext,
  shifts: GeneratedShift[],
  range: LocalDateRange,
): GeneratedShift[] {
  const intervals = context.definition.workingIntervals;
  if (intervals.length === 0 || shifts.length === 0) return shifts;
  const working = datesInRange(addDays(range.from, -1), addDays(range.to, 1))
    .flatMap((date) =>
      intervals
        .filter((interval) => appliesOn(interval, isoWeekday(date)))
        .map((interval) => wallIntervalOn(interval, date, context.dayStartMs)),
    )
    .flatMap(([start, end]) => context.timeline.preimage(start, end));
  const span = {
    start: new Date(Math.min(...shifts.map((s) => s.utcStart.getTime()))),
    end: new Date(Math.max(...shifts.map((s) => s.utcEnd.getTime()))),
  };
  const windows = complementWindows(working, span).map((gap) => ({
    ...gap,
    kind: 'non_working' as const,
    reason: 'outside working intervals',
  }));
  return markWindows(shifts, windows, context.timeline);
}
