import { EntityManager } from 'typeorm';
import {
  longStopKey,
  reachedLevel,
  uncodedBacklogKey,
} from '../domain/notifications/work-reminders';
import { HolderCache, NotificationRow } from './notification-rows';
import { WorkReminderConfig } from './work-reminder-config';
import { plural } from '../common/helpers/plural';

/** Item 6: who codes stops of a unit, and who is told about a stop that keeps running. */
export const BACKLOG_ROLES = ['operator', 'production_engineer'] as const;
export const LONG_STOP_ROLES = [
  'production_engineer',
  'manager_approver',
] as const;

/** Unplanned (or not yet classified) downtime: what coding and a long-stop alert are about. */
const UNPLANNED = `e."physical_type" = 'downtime' AND e."schedule_class" IN ('unplanned', 'unknown')`;

interface OpenStopRow {
  id: string;
  unit_id: string;
  unit_name: string | null;
  start: Date;
}

/** Open unplanned stops running past the first level (IDX_production_events_open_start). */
const OPEN_STOPS_SQL = `SELECT e."id"::text AS "id", e."unit_id"::text AS "unit_id", u."name" AS "unit_name", e."start_time" AS "start"
  FROM "production_events" e LEFT JOIN "units" u ON u."id" = e."unit_id"
 WHERE e."end_time" IS NULL AND e."physical_state" = 'open' AND e."tenant_id" = $1
   AND e."start_time" >= $2 AND e."start_time" <= $3 AND ${UNPLANNED}
 ORDER BY e."start_time", e."id"`;

interface BacklogRow {
  unit_id: string;
  unit_name: string | null;
  local_date: string;
  stops: number;
  uncoded_seconds: number;
  oldest_end: Date;
}

/**
 * Closed uncoded unplanned stops that ended at least the first level ago, per unit and plant production day
 * (the day of the unit's period holding the stop's start, else the start's date in plant time). Uses
 * IDX_production_events_uncoded_stops and UQ_production_periods_unit_start.
 */
const BACKLOG_SQL = `SELECT e."unit_id"::text AS "unit_id", u."name" AS "unit_name",
       to_char(coalesce(pd."local_date", (e."start_time" AT TIME ZONE coalesce(t."timezone", 'UTC'))::date), 'YYYY-MM-DD') AS "local_date",
       count(*)::int AS "stops",
       sum(extract(epoch FROM e."end_time" - e."start_time"))::float8 AS "uncoded_seconds",
       min(e."end_time") AS "oldest_end"
  FROM "production_events" e
  JOIN "tenants" t ON t."id" = e."tenant_id"
  LEFT JOIN "units" u ON u."id" = e."unit_id"
  LEFT JOIN LATERAL (SELECT p."local_date" FROM "production_periods" p
                      WHERE p."tenant_id" = e."tenant_id" AND p."unit_id" = e."unit_id"
                        AND p."utc_start" <= e."start_time" AND p."utc_end" > e."start_time"
                      ORDER BY p."utc_start" DESC LIMIT 1) pd ON true
 WHERE e."tenant_id" = $1 AND e."coding_state" = 'uncoded' AND e."physical_state" = 'closed'
   AND e."end_time" >= $2 AND e."end_time" <= $3 AND ${UNPLANNED}
 GROUP BY 1, 2, 3
 ORDER BY 3, 1`;

/** One row per holder of any of `roles` on the unit (holders cached per role and unit). */
async function rowsForHolders(
  holders: HolderCache,
  target: { roles: readonly string[]; unitId: string },
  row: Omit<NotificationRow, 'user_id'>,
): Promise<NotificationRow[]> {
  const users = new Set<string>();
  for (const role of target.roles) {
    for (const user of await holders.of(role, target.unitId)) users.add(user);
  }
  return [...users].sort().map((userId) => ({ user_id: userId, ...row }));
}

interface AlertInput {
  tenantId: string;
  asOf: Date;
  config: WorkReminderConfig;
  holders: HolderCache;
}

/**
 * `long_open_stop`: an open unplanned stop running past 2 h, then 8 h (defaults) tells production
 * engineering and plant management of its unit once per event and level — the highest level reached only.
 */
export async function longStopRows(
  manager: EntityManager,
  input: AlertInput,
): Promise<NotificationRow[]> {
  const now = input.asOf.getTime();
  const levels = input.config.longStopLevelsMs;
  const stops: OpenStopRow[] = await manager.query(OPEN_STOPS_SQL, [
    input.tenantId,
    new Date(now - input.config.lookbackMs),
    new Date(now - Math.min(...levels)),
  ]);
  const rows: NotificationRow[] = [];
  for (const stop of stops) {
    const runningMs = now - new Date(stop.start).getTime();
    const level = reachedLevel(runningMs, levels);
    if (level === 0) continue;
    const detail = {
      level,
      message: `Stop running for ${Math.floor(runningMs / 3_600_000)} h`,
      eventId: stop.id,
      unitId: stop.unit_id,
      unitName: stop.unit_name,
      startedAt: new Date(stop.start).toISOString(),
      runningSeconds: Math.floor(runningMs / 1000),
      alertedAt: input.asOf.toISOString(),
    };
    const target = { roles: LONG_STOP_ROLES, unitId: stop.unit_id };
    rows.push(
      ...(await rowsForHolders(input.holders, target, {
        kind: 'long_open_stop',
        dedupe_key: longStopKey(stop.id, level),
        entity_type: 'production_event',
        entity_id: stop.id,
        detail,
      })),
    );
  }
  return rows;
}

function backlogDetail(
  day: BacklogRow,
  level: number,
  asOf: Date,
): Record<string, unknown> {
  return {
    level,
    message: `${plural(day.stops, 'uncoded stop', 'uncoded stops')} waiting for a reason`,
    unitId: day.unit_id,
    unitName: day.unit_name,
    localDate: day.local_date,
    stops: day.stops,
    uncodedSeconds: Math.round(day.uncoded_seconds),
    oldestEndedAt: new Date(day.oldest_end).toISOString(),
    alertedAt: asOf.toISOString(),
  };
}

/**
 * `uncoded_backlog`: a unit and production day with an uncoded unplanned stop that ended 4 h ago, then 24 h
 * (defaults), tells the operators and production engineers of the unit once per unit, day and level — the
 * highest level its oldest uncoded stop reached.
 */
export async function uncodedBacklogRows(
  manager: EntityManager,
  input: AlertInput,
): Promise<NotificationRow[]> {
  const now = input.asOf.getTime();
  const levels = input.config.uncodedLevelsMs;
  const days: BacklogRow[] = await manager.query(BACKLOG_SQL, [
    input.tenantId,
    new Date(now - input.config.lookbackMs),
    new Date(now - Math.min(...levels)),
  ]);
  const rows: NotificationRow[] = [];
  for (const day of days) {
    const level = reachedLevel(
      now - new Date(day.oldest_end).getTime(),
      levels,
    );
    if (level === 0) continue;
    const detail = backlogDetail(day, level, input.asOf);
    const target = { roles: BACKLOG_ROLES, unitId: day.unit_id };
    rows.push(
      ...(await rowsForHolders(input.holders, target, {
        kind: 'uncoded_backlog',
        dedupe_key: uncodedBacklogKey(day.unit_id, day.local_date, level),
        entity_type: 'unit',
        entity_id: day.unit_id,
        detail,
      })),
    );
  }
  return rows;
}
