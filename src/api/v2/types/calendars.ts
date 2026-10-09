/**
 * Calendar versions, previews, crews and rotations (backend `src/v2/calendars/calendar-v2.view.ts` and
 * `crew-v2.view.ts`, plan 2.1). Local times `HH:mm`, local (operational) dates `YYYY-MM-DD`, offsets in
 * minutes east of UTC; durations in seconds.
 */
export const EXCLUSION_KINDS = ['planned_shutdown', 'turnaround', 'no_demand'] as const;
export type ExclusionKind = (typeof EXCLUSION_KINDS)[number];

/** `reduced` is stored and warned about, but no reduction rule is decided yet (DECISIONS 2.1). */
export const HOLIDAY_TREATMENTS = ['excluded', 'reduced'] as const;
export type HolidayTreatment = (typeof HOLIDAY_TREATMENTS)[number];

export interface ShiftTemplate {
  name: string;
  startLocal: string;
  endLocal: string;
  daysOfWeek?: number[];
}

export interface WorkingInterval {
  startLocal: string;
  endLocal: string;
  daysOfWeek?: number[];
}

export interface Holiday {
  date: string;
  name: string;
  treatment: HolidayTreatment;
}

export interface ScheduleExclusion {
  /** ISO 8601 with offset, half-open */
  from: string;
  to: string;
  reason: string;
  kind: ExclusionKind;
}

export interface CalendarDefinition {
  timezone?: string;
  operationalDayStart?: string;
  shiftTemplates: ShiftTemplate[];
  workingIntervals?: WorkingInterval[];
  holidays?: Holiday[];
  exclusions?: ScheduleExclusion[];
}

export interface CalendarVersionView {
  id: string;
  siteId: string;
  unitId: string | null;
  version: number;
  state: 'draft' | 'published';
  timezone: string;
  operationalDayStart: string;
  shiftTemplates: ShiftTemplate[];
  workingIntervals: WorkingInterval[];
  holidays: Holiday[];
  exclusions: ScheduleExclusion[];
  effectiveFrom: string;
  effectiveTo: string | null;
  publishedBy: string | null;
  publishedAt: string | null;
  republishReason: string | null;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
}

/** A stored or previewed shift instance. */
export interface ShiftInstancePreview {
  id: string | null;
  unitId: string | null;
  calendarVersionId: string | null;
  localDate: string;
  shiftName: string;
  utcStart: string;
  utcEnd: string;
  durationSeconds: number;
  utcOffsetStart: number;
  utcOffsetEnd: number;
  localStart: string;
  localEnd: string;
  isExcluded: boolean;
  exclusionKind: string | null;
  exclusionReason: string | null;
  crewId: string | null;
}

export type CalendarWarningCode = 'dst_gap' | 'dst_repeat' | 'dst_split' | 'holiday_reduced' | 'crew_conflict' | 'timezone_fallback';

export interface CalendarWarning {
  code: CalendarWarningCode | string;
  localDate: string;
  shiftName: string | null;
  nominalSeconds?: number;
  actualSeconds?: number;
  detail?: string;
}

export interface CalendarPreviewView {
  unitId: string;
  siteId: string;
  timezone: string;
  candidateVersionId: string | null;
  scheduledSeconds: number;
  instances: ShiftInstancePreview[];
  warnings: CalendarWarning[];
  diff: {
    added: ShiftInstancePreview[];
    removed: ShiftInstancePreview[];
    changed: Array<{ utcStart: string; current: ShiftInstancePreview; candidate: ShiftInstancePreview }>;
    unchangedCount: number;
  };
}

export interface UnitMaterialization {
  unitId: string;
  from: string;
  to: string;
  insertedInstances: number;
  deletedInstances: number;
  unchangedDates: number;
  hash: string;
}

export interface CalendarPublishView {
  version: CalendarVersionView;
  materialization: UnitMaterialization[];
}

export interface CrewView {
  id: string;
  siteId: string;
  name: string;
  rowVersion: number;
  createdAt: string;
}

export interface RotationPattern {
  anchorDate: string;
  /** shift name per day of the cycle; null = off */
  cycle: Array<string | null>;
}

export interface CrewRotationView {
  id: string;
  crewId: string;
  pattern: RotationPattern;
  effectiveFrom: string;
  effectiveTo: string | null;
  rowVersion: number;
  createdAt: string;
}

export interface CrewRotationCreatedView {
  rotation: CrewRotationView;
  materialization: UnitMaterialization[];
}
