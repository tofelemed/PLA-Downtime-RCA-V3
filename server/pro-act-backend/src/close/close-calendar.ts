import { DateTime } from 'luxon';
import { EntityManager } from 'typeorm';
import { versionOn } from '../calendar/calendar-resolution';
import { CalendarVersion } from '../calendar/entities/calendar-version.entity';
import { addDays } from '../domain/calendar/wall-clock';
import { WorkingCalendar } from '../domain/close/working-days';

/** Days after month end the close calendar reads holidays for (working day 5 rarely lies further out). */
const HORIZON_DAYS = 60;

/** The plant's time zone and the working calendar after a month end. */
export interface PlantCloseCalendar {
  timezone: string;
  working: WorkingCalendar;
}

/**
 * The plant's default site, null before the site exists. Its time zone is the one of the latest published
 * site calendar version (the calendar the periods were cut with), else the site's own.
 */
export async function defaultSiteOf(
  manager: EntityManager,
  tenantId: string,
): Promise<{ id: string; timezone: string } | null> {
  const rows: Array<{ id: string; timezone: string }> = await manager.query(
    `SELECT s."id", coalesce(cv."timezone", s."timezone") AS "timezone"
       FROM "sites" s
       LEFT JOIN LATERAL (SELECT v."timezone" FROM "calendar_versions" v
                           WHERE v."site_id" = s."id" AND v."unit_id" IS NULL AND v."state" = 'published'
                           ORDER BY v."version" DESC LIMIT 1) cv ON true
      WHERE s."tenant_id" = $1 AND s."is_default" LIMIT 1`,
    [tenantId],
  );
  return rows[0] ?? null;
}

/**
 * Holidays of the default site's published calendar versions in force on each date of `[from, from + 60
 * days)` (SME R4: working days count against the approved holiday calendar). Every holiday treatment
 * counts as a non-working day for the close (engineering default).
 */
export async function plantCloseCalendar(
  manager: EntityManager,
  tenantId: string,
  input: { from: string; weekendDays: readonly number[] },
): Promise<PlantCloseCalendar> {
  const to = addDays(input.from, HORIZON_DAYS);
  const site = await defaultSiteOf(manager, tenantId);
  const versions = site
    ? await manager
        .getRepository(CalendarVersion)
        .createQueryBuilder('cv')
        .where('cv.tenantId = :tenantId AND cv.siteId = :siteId', {
          tenantId,
          siteId: site.id,
        })
        .andWhere("cv.unitId IS NULL AND cv.state = 'published'")
        .andWhere('cv.effectiveFrom < :to', { to })
        .andWhere('(cv.effectiveTo IS NULL OR cv.effectiveTo > :from)', {
          from: input.from,
        })
        .getMany()
    : [];
  const holidays = new Set<string>();
  for (const version of versions) {
    for (const holiday of version.holidays) {
      const inForce = versionOn(versions, '', holiday.date);
      if (inForce?.id === version.id) holidays.add(holiday.date);
    }
  }
  return {
    timezone: site?.timezone ?? 'UTC',
    working: { weekendDays: input.weekendDays, holidays },
  };
}

/** The end of a plant-local date: the next local midnight, as a UTC instant. */
export function endOfLocalDay(localDate: string, timezone: string): Date {
  return DateTime.fromISO(addDays(localDate, 1), { zone: timezone })
    .startOf('day')
    .toJSDate();
}

/** The plant-local date of an instant. */
export function localDateOf(instant: Date, timezone: string): string {
  return DateTime.fromJSDate(instant, { zone: timezone }).toISODate() ?? '';
}
