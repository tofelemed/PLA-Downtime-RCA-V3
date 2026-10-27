import { ConflictException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CalendarVersion } from '../../calendar/entities/calendar-version.entity';
import { operationalDateAt } from '../../domain/calendar/schedule-metrics';
import {
  addDays,
  formatLocal,
  msOfTime,
  normalizeTime,
  wallOfDate,
} from '../../domain/calendar/wall-clock';
import {
  ZoneTimeline,
  zoneOffsetAt,
} from '../../domain/calendar/zone-timeline';
import {
  deletePeriods,
  HAS_HISTORY,
} from './loss-accounting-period-retirement';

/** Name of the one shift of the daily calendar. */
export const DAILY_SHIFT_NAME = 'Day';

/** Where the daily calendar of a day-grain approval takes over from the old calendar. */
export interface DailySwitch {
  /** first operational date of the daily calendar */
  date: string;
  /** its first instant: `dayStart` of `date`, plant local */
  start: Date;
}

/** The units, the zone and the day start of a switch. */
export interface SwitchScope {
  tenantId: string;
  unitIds: string[];
  zone: string;
  dayStart: string;
}

/** Old-calendar rows of the scope from the switch on; `calendarVersionId` = the daily version (kept). */
export interface SwitchCut {
  tenantId: string;
  unitIds: string[];
  start: Date;
  calendarVersionId: string;
}

export interface InstanceCut {
  removedInstances: number;
  clippedInstances: number;
}

export interface PeriodCut {
  retired: number;
  clippedPeriods: number;
}

/** UTC instant of `dayStart` on a plant-local operational date. */
export function boundaryOf(zone: string, date: string, dayStart: string): Date {
  const wall = wallOfDate(date) + msOfTime(dayStart);
  return new Date(ZoneTimeline.forWallRange(zone, wall, wall).instantOf(wall));
}

/**
 * The first `dayStart` boundary on or after the effective date that is not before the end of the last
 * period of the scope with calculation history or an approved revision: the daily calendar never cuts a
 * period that cannot be deleted. Open, never calculated periods and instances without a period do not
 * push it.
 */
export async function switchOf(
  manager: EntityManager,
  scope: SwitchScope,
  fromDate: string,
): Promise<DailySwitch> {
  const earliest = boundaryOf(scope.zone, fromDate, scope.dayStart);
  const [row] = await manager.query<Array<{ last: Date | null }>>(
    `SELECT max(p."utc_end") AS "last" FROM "production_periods" p
      WHERE p."tenant_id" = $1 AND p."unit_id" = ANY($2::uuid[]) AND p."utc_end" > $3 AND ${HAS_HISTORY}`,
    [scope.tenantId, scope.unitIds, earliest],
  );
  if (!row?.last) return { date: fromDate, start: earliest };
  const last = new Date(row.last);
  const day = operationalDateAt(last, scope.zone, scope.dayStart);
  const start = boundaryOf(scope.zone, day, scope.dayStart);
  if (start.getTime() >= last.getTime()) return { date: day, start };
  const next = addDays(day, 1);
  return { date: next, start: boundaryOf(scope.zone, next, scope.dayStart) };
}

/** Site scope: the units without a unit override from `fromDate` on (an override keeps its own calendar). */
export async function unitsOnSiteCalendar(
  manager: EntityManager,
  scope: { tenantId: string; unitIds: string[] },
  fromDate: string,
): Promise<string[]> {
  const rows = await manager.query<Array<{ unit_id: string }>>(
    `SELECT DISTINCT "unit_id" FROM "calendar_versions"
      WHERE "tenant_id" = $1 AND "unit_id" = ANY($2::uuid[]) AND "state" = 'published'
        AND ("effective_to" IS NULL OR "effective_to" > $3::date)`,
    [scope.tenantId, scope.unitIds, fromDate],
  );
  const overridden = new Set(rows.map((row) => row.unit_id));
  return scope.unitIds.filter((id) => !overridden.has(id));
}

/**
 * Before the daily calendar is published (its own committed transaction, under the materializer's
 * per-unit lock): old-calendar instances that start at or after the switch are removed, and the one
 * crossing it ends there, so the daily instances fit without overlap.
 */
export async function cutInstances(
  manager: EntityManager,
  cut: SwitchCut & { zone: string; actorId: string | null },
): Promise<InstanceCut> {
  for (const unitId of [...cut.unitIds].sort()) {
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `shift_instances:${unitId}`,
    ]);
  }
  const params = [cut.tenantId, cut.unitIds, cut.start, cut.calendarVersionId];
  const scope = `"tenant_id" = $1 AND "unit_id" = ANY($2::uuid[]) AND "calendar_version_id" <> $4`;
  const [, removed] = await manager.query<[unknown, number]>(
    `DELETE FROM "shift_instances" WHERE ${scope} AND "utc_start" >= $3`,
    params,
  );
  const offsetEnd = zoneOffsetAt(cut.zone, new Date(cut.start.getTime() - 1));
  const [, clipped] = await manager.query<[unknown, number]>(
    `UPDATE "shift_instances" SET "utc_end" = $3, "utc_offset_end" = $5, "local_end" = $6,
            "updated_by" = $7, "updated_at" = now(), "row_version" = "row_version" + 1
      WHERE ${scope} AND "utc_start" < $3 AND "utc_end" > $3`,
    [
      ...params,
      offsetEnd,
      formatLocal(cut.start.getTime(), offsetEnd),
      cut.actorId,
    ],
  );
  return { removedInstances: removed, clippedInstances: clipped };
}

interface PeriodAtSwitch {
  id: string;
  crossing: boolean;
  history: boolean;
}

/**
 * In the approval transaction: old-calendar periods that start at or after the switch are retired (as
 * `retireOpenPeriods` does), and the period crossing it ends there with its slices. None of them can have
 * calculation history (the switch is placed after the last one); 409 when one has gained it since.
 */
export async function cutPeriods(
  manager: EntityManager,
  cut: SwitchCut,
): Promise<PeriodCut> {
  const rows = await manager.query<PeriodAtSwitch[]>(
    `SELECT p."id", p."utc_start" < $3 AS "crossing", ${HAS_HISTORY} AS "history"
       FROM "production_periods" p
      WHERE p."tenant_id" = $1 AND p."unit_id" = ANY($2::uuid[]) AND p."utc_end" > $3
        AND p."calendar_version_id" IS DISTINCT FROM $4
      FOR UPDATE OF p`,
    [cut.tenantId, cut.unitIds, cut.start, cut.calendarVersionId],
  );
  if (rows.some((row) => row.history)) {
    throw new ConflictException({
      code: 'SWITCH_CROSSES_CALCULATION',
      message:
        'a period after the start of the daily calendar has calculation history; approve again',
    });
  }
  const retire = rows.filter((row) => !row.crossing).map((row) => row.id);
  const clip = rows.filter((row) => row.crossing).map((row) => row.id);
  if (retire.length > 0) await deletePeriods(manager, retire);
  if (clip.length > 0) await clipPeriods(manager, clip, cut.start);
  return { retired: retire.length, clippedPeriods: clip.length };
}

async function clipPeriods(
  manager: EntityManager,
  periodIds: string[],
  end: Date,
): Promise<void> {
  await manager.query(
    `DELETE FROM "period_product_slices" WHERE "period_id" = ANY($1::uuid[]) AND "window_from" >= $2`,
    [periodIds, end],
  );
  await manager.query(
    `UPDATE "period_product_slices" SET "window_to" = $2 WHERE "period_id" = ANY($1::uuid[]) AND "window_to" > $2`,
    [periodIds, end],
  );
  await manager.query(
    `UPDATE "production_periods" SET "utc_end" = $2, "updated_at" = now(), "row_version" = "row_version" + 1
      WHERE "id" = ANY($1::uuid[])`,
    [periodIds, end],
  );
}

/** One 24 h shift per day from `dayStart`: the shape of the daily calendar. */
export function isDailyShape(
  version: Pick<CalendarVersion, 'shiftTemplates' | 'operationalDayStart'>,
  dayStart: string,
): boolean {
  const [template] = version.shiftTemplates;
  return (
    version.shiftTemplates.length === 1 &&
    !template.daysOfWeek &&
    template.startLocal === template.endLocal &&
    normalizeTime(template.startLocal) === dayStart &&
    normalizeTime(version.operationalDayStart) === dayStart
  );
}

/**
 * A draft exactly as a day-grain approval writes it (one "Day" template, nothing else, open-ended): left
 * behind when the publication failed, it is reused instead of creating another.
 */
export function isDailyDraft(
  version: CalendarVersion,
  dayStart: string,
): boolean {
  const empty = (list: unknown[] | null | undefined) => !list?.length;
  return (
    version.state === 'draft' &&
    version.effectiveTo === null &&
    version.shiftTemplates.length === 1 &&
    version.shiftTemplates[0].name === DAILY_SHIFT_NAME &&
    isDailyShape(version, dayStart) &&
    empty(version.workingIntervals) &&
    empty(version.holidays) &&
    empty(version.exclusions)
  );
}
