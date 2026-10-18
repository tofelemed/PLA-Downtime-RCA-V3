/**
 * Calendar definitions and generated shift instances (spec CAL01, CAL02, §14.2 `calendar_versions`,
 * `shift_instances`). Local times are `HH:mm`, local dates `YYYY-MM-DD`; instances carry UTC bounds,
 * the offsets in force at their start and end, and their local labels.
 */

export const EXCLUSION_KINDS = [
  'planned_shutdown',
  'turnaround',
  'no_demand',
] as const;
export type ExclusionKind = (typeof EXCLUSION_KINDS)[number];

/** Why an instance (or part of one) is outside scheduled time. */
export const SCHEDULE_EXCLUSION_KINDS = [
  ...EXCLUSION_KINDS,
  'holiday',
  'non_working',
] as const;
export type ScheduleExclusionKind = (typeof SCHEDULE_EXCLUSION_KINDS)[number];

export const HOLIDAY_TREATMENTS = ['excluded', 'reduced'] as const;
export type HolidayTreatment = (typeof HOLIDAY_TREATMENTS)[number];

export interface ShiftTemplate {
  name: string;
  startLocal: string;
  /** equal to `startLocal` = 24 h; earlier = the shift crosses midnight */
  endLocal: string;
  /** ISO weekdays (1 = Monday) of the operational day the shift belongs to; every day when absent */
  daysOfWeek?: number[];
}

/** Finer than shifts: when any are defined, shift time outside them is `non_working`. */
export interface WorkingInterval {
  startLocal: string;
  endLocal: string;
  daysOfWeek?: number[];
}

export interface Holiday {
  /** operational date */
  date: string;
  name: string;
  treatment: HolidayTreatment;
  /** Explicit working windows for this reduced-hours operational date. */
  workingIntervals?: WorkingInterval[];
}

export interface ScheduleExclusion {
  /** ISO 8601 instants with an offset; half-open `[from, to)` */
  from: string;
  to: string;
  reason: string;
  kind: ExclusionKind;
}

export interface CalendarDefinition {
  timezone: string;
  /** `HH:mm`: the operational (production) day starts here */
  operationalDayStart: string;
  shiftTemplates: ShiftTemplate[];
  workingIntervals: WorkingInterval[];
  holidays: Holiday[];
  exclusions: ScheduleExclusion[];
}

export interface GeneratedShift {
  /** operational (production) date the shift belongs to */
  localDate: string;
  shiftName: string;
  utcStart: Date;
  utcEnd: Date;
  /** minutes east of UTC at the start, and just before the end */
  utcOffsetStart: number;
  utcOffsetEnd: number;
  localStart: string;
  localEnd: string;
  isExcluded: boolean;
  exclusionKind: ScheduleExclusionKind | null;
  exclusionReason: string | null;
  crewId: string | null;
}

export const CALENDAR_WARNING_CODES = [
  'dst_gap',
  'dst_repeat',
  'dst_split',
  'holiday_reduced',
  'crew_conflict',
  'timezone_fallback',
] as const;
export type CalendarWarningCode = (typeof CALENDAR_WARNING_CODES)[number];

/** A generation note for the preview (§3.3): DST shortened/lengthened/split shifts, crew conflicts. */
export interface CalendarWarning {
  code: CalendarWarningCode;
  localDate: string;
  shiftName: string | null;
  /** wall-clock length of the template and the elapsed seconds actually generated */
  nominalSeconds?: number;
  actualSeconds?: number;
  detail?: string;
}

export interface GenerationResult {
  instances: GeneratedShift[];
  warnings: CalendarWarning[];
}

/** A configuration mistake the generator refuses (422 at the API). */
export class CalendarDefinitionError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'CalendarDefinitionError';
  }
}
