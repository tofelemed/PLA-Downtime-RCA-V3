import { CalendarPreview } from '../../calendar/calendar-preview.service';
import { PublishResult } from '../../calendar/calendar-publish.service';
import { UnitMaterialization } from '../../calendar/calendar-materializer.service';
import { CalendarVersion } from '../../calendar/entities/calendar-version.entity';
import { ShiftInstance } from '../../calendar/entities/shift-instance.entity';
import { Site } from '../../calendar/entities/site.entity';
import { InstanceDiff } from '../../calendar/instance-diff';
import {
  CalendarWarning,
  GeneratedShift,
  Holiday,
  ScheduleExclusion,
  ShiftTemplate,
  WorkingInterval,
} from '../../domain/calendar/calendar.types';
import { scheduledSeconds } from '../../domain/calendar/schedule-metrics';
import { normalizeTime } from '../../domain/calendar/wall-clock';

export interface SiteV2View {
  id: string;
  name: string;
  timezone: string;
  /** the tenant had no valid IANA timezone; `UTC` was used */
  timezoneFallback: boolean;
  operationalDayStart: string;
  isDefault: boolean;
  rowVersion: number;
  createdAt: string;
}

export interface CalendarVersionV2View {
  id: string;
  siteId: string;
  unitId: string | null;
  version: number;
  state: string;
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

/** A shift instance (stored or previewed): UTC bounds, offsets in minutes east of UTC, local labels. */
export interface ShiftInstanceV2View {
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

export interface CalendarPublishV2View {
  version: CalendarVersionV2View;
  materialization: UnitMaterialization[];
}

export interface CalendarPreviewV2View {
  unitId: string;
  siteId: string;
  timezone: string;
  candidateVersionId: string | null;
  /** non-excluded seconds of the candidate over the whole range */
  scheduledSeconds: number;
  instances: ShiftInstanceV2View[];
  warnings: CalendarWarning[];
  diff: {
    added: ShiftInstanceV2View[];
    removed: ShiftInstanceV2View[];
    changed: Array<{
      utcStart: string;
      current: ShiftInstanceV2View;
      candidate: ShiftInstanceV2View;
    }>;
    unchangedCount: number;
  };
}

export function toSiteView(site: Site): SiteV2View {
  return {
    id: site.id,
    name: site.name,
    timezone: site.timezone,
    timezoneFallback: site.timezoneFallback,
    operationalDayStart: normalizeTime(site.operationalDayStart),
    isDefault: site.isDefault,
    rowVersion: site.rowVersion,
    createdAt: site.createdAt.toISOString(),
  };
}

export function toCalendarVersionView(
  version: CalendarVersion,
): CalendarVersionV2View {
  return {
    id: version.id,
    siteId: version.siteId,
    unitId: version.unitId,
    version: version.version,
    state: version.state,
    timezone: version.timezone,
    operationalDayStart: normalizeTime(version.operationalDayStart),
    shiftTemplates: version.shiftTemplates,
    workingIntervals: version.workingIntervals,
    holidays: version.holidays,
    exclusions: version.exclusions,
    effectiveFrom: version.effectiveFrom,
    effectiveTo: version.effectiveTo,
    publishedBy: version.publishedBy,
    publishedAt: version.publishedAt ? version.publishedAt.toISOString() : null,
    republishReason: version.republishReason,
    rowVersion: version.rowVersion,
    createdAt: version.createdAt.toISOString(),
    updatedAt: version.updatedAt.toISOString(),
  };
}

export function toShiftInstanceView(
  shift: GeneratedShift & {
    id?: string;
    unitId?: string;
    calendarVersionId?: string | null;
  },
): ShiftInstanceV2View {
  const start = new Date(shift.utcStart);
  const end = new Date(shift.utcEnd);
  return {
    id: shift.id ?? null,
    unitId: shift.unitId ?? null,
    calendarVersionId: shift.calendarVersionId ?? null,
    localDate: shift.localDate,
    shiftName: shift.shiftName,
    utcStart: start.toISOString(),
    utcEnd: end.toISOString(),
    durationSeconds: (end.getTime() - start.getTime()) / 1000,
    utcOffsetStart: shift.utcOffsetStart,
    utcOffsetEnd: shift.utcOffsetEnd,
    localStart: shift.localStart,
    localEnd: shift.localEnd,
    isExcluded: shift.isExcluded,
    exclusionKind: shift.exclusionKind,
    exclusionReason: shift.exclusionReason,
    crewId: shift.crewId,
  };
}

export function toStoredInstanceView(
  instance: ShiftInstance,
): ShiftInstanceV2View {
  return toShiftInstanceView(instance);
}

export function toPublishView(result: PublishResult): CalendarPublishV2View {
  return {
    version: toCalendarVersionView(result.version),
    materialization: result.materialization,
  };
}

export function toPreviewView(preview: CalendarPreview): CalendarPreviewV2View {
  const instances = preview.instances;
  const span = instances.length
    ? {
        start: instances[0].utcStart,
        end: instances[instances.length - 1].utcEnd,
      }
    : null;
  return {
    unitId: preview.unitId,
    siteId: preview.siteId,
    timezone: preview.timezone,
    candidateVersionId: preview.candidateVersionId,
    scheduledSeconds: span ? scheduledSeconds(instances, span) : 0,
    instances: instances.map(toShiftInstanceView),
    warnings: preview.warnings,
    diff: toDiffView(preview.diff),
  };
}

function toDiffView(diff: InstanceDiff): CalendarPreviewV2View['diff'] {
  return {
    added: diff.added.map(toShiftInstanceView),
    removed: diff.removed.map(toShiftInstanceView),
    changed: diff.changed.map((change) => ({
      utcStart: change.utcStart,
      current: toShiftInstanceView(change.current),
      candidate: toShiftInstanceView(change.candidate),
    })),
    unchangedCount: diff.unchangedCount,
  };
}
