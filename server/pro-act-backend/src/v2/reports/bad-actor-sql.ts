import { EntityManager } from 'typeorm';
import {
  PlantCalendar,
  plantMonthDates,
} from '../../domain/calendar/plant-month';
import { BadActorGroup } from '../../domain/rca/bad-actor';
import { failureModeKeySql } from '../../domain/rca/failure-mode-key';
import { LOSS_VALUE_KINDS } from '../../domain/valuation/reconciled-valuation';
import { invalid } from '../../profiles/profile-errors';
import { INCIDENT } from '../../rca-case/triggers/trigger-inputs';
import { ReportScope } from './report-scope';
import { params, SHOWN } from './report-sql';

/** Group key over `production_events e`: the asset, or asset and failure mode (CA8 identity). */
const MODE = failureModeKeySql('asset_and_mode');
export const KEY_SQL: Readonly<Record<BadActorGroup, string>> = {
  asset: `e."asset_id"::text`,
  failure_mode: `e."asset_id"::text || '|' || COALESCE(${MODE}, 'unspecified')`,
};

const KINDS = [...LOSS_VALUE_KINDS];

/**
 * Approved plan lines of the approved periods in scope with their cause event's group key ($1–$5 the
 * report scope with approvedOnly, $6 loss kinds): the stored approved lines, or the approved run's lines
 * for revisions approved before they were stored (VA-01b), like the loss tree.
 */
const APPROVED = (key: string) => `${SHOWN}, al AS (
  SELECT x."line_id", x."origin", x."uom", x."quantity", ${key} AS "group_key"
    FROM shown s
    JOIN LATERAL (
      SELECT a."id" AS "line_id", 'approved' AS "origin", a."uom", a."quantity", a."cause_event_id"
        FROM "approved_loss_lines" a
       WHERE a."revision_id" = s."revision_id" AND a."tenant_id" = $1 AND a."kind"::text = ANY($6::text[])
      UNION ALL
      SELECT r."id", 'run', r."uom", r."quantity", r."cause_event_id"
        FROM "loss_lines" r
       WHERE r."run_id" = s."run_id" AND r."tenant_id" = $1 AND r."period_id" = s."period_id"
         AND r."ledger" = 'plan' AND r."state" = 'active' AND r."source" <> 'candidate_superseded'
         AND r."kind"::text = ANY($6::text[])
         AND NOT EXISTS (SELECT 1 FROM "approved_loss_lines" z WHERE z."revision_id" = s."revision_id" AND z."tenant_id" = $1)
    ) x ON x."cause_event_id" IS NOT NULL
    JOIN "production_events" e ON e."id" = x."cause_event_id" AND e."tenant_id" = $1::uuid
   WHERE s."lifecycle" = 'approved' AND e."asset_id" IS NOT NULL)`;

const VALUES = `JOIN LATERAL (
    SELECT lv."currency", lv."amount", lv."status"::text AS "status", lv."provisional" FROM "loss_line_valuations" lv
     WHERE al."origin" = 'run' AND lv."tenant_id" = $1 AND lv."loss_line_id" = al."line_id" AND lv."view" = $9::valuation_view
    UNION ALL
    SELECT av."currency", av."amount", av."status", av."provisional" FROM "approved_loss_line_valuations" av
     WHERE al."origin" = 'approved' AND av."tenant_id" = $1 AND av."approved_line_id" = al."line_id"
       AND av."view" = $9::valuation_view
  ) v ON true`;

/** Keys filter ($7, null = every key) and the ranking cut ($8, null = no limit). */
const FILTER = `($7::text[] IS NULL OR al."group_key" = ANY($7::text[]))`;

export interface Selection {
  keys: string[] | null;
  limit: number | null;
}

const base = (scope: ReportScope, selection: Selection) => [
  ...params({ ...scope, approvedOnly: true }),
  KINDS,
  selection.keys,
  selection.limit,
];

export interface QuantityRow {
  group_key: string;
  uom: string | null;
  quantity: string;
  lines: number;
}

/** Approved lost quantity per key and unit of measure; with `uom` ($9) ranked largest first. */
export function quantities(
  manager: EntityManager,
  scope: ReportScope,
  input: Selection & { group: BadActorGroup; uom?: string | null },
): Promise<QuantityRow[]> {
  const ranked = input.uom !== undefined;
  return manager.query<QuantityRow[]>(
    `${APPROVED(KEY_SQL[input.group])}
     SELECT al."group_key", al."uom", sum(al."quantity")::text AS "quantity", count(*)::int AS "lines"
       FROM al WHERE ${FILTER} ${ranked ? 'AND al."uom" IS NOT DISTINCT FROM $9::text' : ''}
      GROUP BY 1, 2 ORDER BY sum(al."quantity") DESC, 1 LIMIT $8`,
    [...base(scope, input), ...(ranked ? [input.uom] : [])],
  );
}

/** The unit of measure with the most approved loss in scope (the quantity ranking compares in it). */
export async function rankingUom(
  manager: EntityManager,
  scope: ReportScope,
  group: BadActorGroup,
): Promise<string | null> {
  const [row] = await manager.query<Array<{ uom: string | null }>>(
    `${APPROVED(KEY_SQL[group])}
     SELECT al."uom" FROM al WHERE ${FILTER} GROUP BY 1 ORDER BY sum(al."quantity") DESC LIMIT $8`,
    base(scope, { keys: null, limit: 1 }),
  );
  return row?.uom ?? null;
}

export interface ValueRow {
  group_key: string;
  currency: string;
  amount: string | null;
  valued: number;
  unvalued: number;
  fx_missing: number;
  fx_provisional: number;
}

/** Approved value of one view ($9) in one currency ($10) per key, largest known amount first. */
export function values(
  manager: EntityManager,
  scope: ReportScope,
  input: Selection & { group: BadActorGroup; view: string; currency: string },
): Promise<ValueRow[]> {
  return manager.query<ValueRow[]>(
    `${APPROVED(KEY_SQL[input.group])}
     SELECT c."group_key", c."currency", c."amount"::text AS "amount", c."valued", c."unvalued", c."fx_missing",
            c."fx_provisional"
       FROM (
         SELECT al."group_key", v."currency",
                CASE WHEN count(*) FILTER (WHERE v."status" = 'valued') = 0
                       OR count(*) FILTER (WHERE v."status" = 'valued' AND v."amount" IS NULL) > 0 THEN NULL
                     ELSE sum(v."amount") FILTER (WHERE v."status" = 'valued') END AS "amount",
                count(*) FILTER (WHERE v."status" = 'valued')::int AS "valued",
                count(*) FILTER (WHERE v."status" IS DISTINCT FROM 'valued')::int AS "unvalued",
                count(*) FILTER (WHERE v."status" = 'valued' AND v."amount" IS NULL)::int AS "fx_missing",
                count(*) FILTER (WHERE v."status" = 'valued' AND v."amount" IS NOT NULL AND v."provisional")::int AS "fx_provisional"
           FROM al ${VALUES}
          WHERE ${FILTER} AND v."currency" = $10::text
          GROUP BY 1, 2) c
      ORDER BY c."amount" DESC NULLS LAST, c."group_key" LIMIT $8`,
    [...base(scope, input), input.view, input.currency],
  );
}

export interface StopRow {
  group_key: string;
  stops: number;
  seconds: string;
}

/**
 * CA8 incidents (unplanned stops and failure work orders, live) starting in the window per key, most
 * first, and their unplanned downtime seconds (elapsed until the window end while open).
 */
export function stops(
  manager: EntityManager,
  scope: ReportScope,
  input: Selection & { group: BadActorGroup },
): Promise<StopRow[]> {
  const key = KEY_SQL[input.group];
  return manager.query<StopRow[]>(
    `SELECT ${key} AS "group_key", count(DISTINCT COALESCE(e."occurrence_id", e."id"))::int AS "stops",
            COALESCE(sum(EXTRACT(EPOCH FROM (LEAST(COALESCE(e."end_time", now()), $4) - e."start_time")))
              FILTER (WHERE e."physical_type" = 'downtime'), 0)::text AS "seconds"
       FROM "production_events" e
      WHERE e."tenant_id" = $1 AND e."unit_id" = ANY($2::uuid[]) AND e."start_time" >= $3 AND e."start_time" < $4
        AND e."asset_id" IS NOT NULL AND ${INCIDENT}
        AND ($5::text[] IS NULL OR ${key} = ANY($5::text[]))
      GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT $6`,
    [
      scope.tenantId,
      scope.unitIds,
      scope.from,
      scope.to,
      input.keys,
      input.limit,
    ],
  );
}

export interface ModeSecondsRow {
  asset_id: string;
  seconds: string;
}

/** CA8 bad actor input: the largest same-mode unplanned downtime of each asset in the window. */
export function modeSeconds(
  manager: EntityManager,
  scope: ReportScope,
  assetIds: string[],
): Promise<ModeSecondsRow[]> {
  return manager.query<ModeSecondsRow[]>(
    `SELECT m."asset_id", max(m."seconds")::text AS "seconds" FROM (
       SELECT e."asset_id"::text AS "asset_id", ${MODE} AS "mode",
              sum(EXTRACT(EPOCH FROM (LEAST(COALESCE(e."end_time", now()), $4) - e."start_time"))) AS "seconds"
         FROM "production_events" e
        WHERE e."tenant_id" = $1 AND e."unit_id" = ANY($2::uuid[]) AND e."asset_id" = ANY($5::uuid[])
          AND e."start_time" >= $3 AND e."start_time" < $4
          AND e."physical_state" IN ('open', 'closed') AND e."physical_type" = 'downtime'
          AND e."schedule_class" = 'unplanned' AND ${MODE} IS NOT NULL
        GROUP BY 1, 2) m
      GROUP BY 1`,
    [scope.tenantId, scope.unitIds, scope.from, scope.to, assetIds],
  );
}

export interface FiringRow {
  asset_id: string;
  fired_at: Date;
  rca_id: string | null;
  outcome: string;
}

/** The latest cumulative (bad actor) firing per asset on an event that started in the window. */
export function firings(
  manager: EntityManager,
  scope: ReportScope,
  assetIds: string[],
): Promise<FiringRow[]> {
  return manager.query<FiringRow[]>(
    `SELECT DISTINCT ON (e."asset_id") e."asset_id"::text AS "asset_id", t."fired_at", t."rca_id"::text AS "rca_id",
            t."outcome"::text AS "outcome"
       FROM "rca_trigger_evaluations" t
       JOIN "production_events" e ON e."id" = t."event_id" AND e."tenant_id" = $1::uuid
      WHERE t."tenant_id" = $1 AND t."trigger" = 'cumulative' AND t."unit_id" = ANY($2::uuid[])
        AND e."start_time" >= $3 AND e."start_time" < $4 AND e."asset_id" = ANY($5::uuid[])
      ORDER BY e."asset_id", t."fired_at" DESC`,
    [scope.tenantId, scope.unitIds, scope.from, scope.to, assetIds],
  );
}

export interface AssetRow {
  id: string;
  code: string;
  name: string;
  unit_id: string;
  criticality: string | null;
}

export function assetsOf(
  manager: EntityManager,
  tenantId: string,
  assetIds: string[],
): Promise<AssetRow[]> {
  return manager.query<AssetRow[]>(
    `SELECT "id"::text AS "id", "code", "name", "unit_id", "criticality" FROM "assets"
      WHERE "id"::text = ANY($1::text[]) AND "tenant_id" = $2`,
    [assetIds, tenantId],
  );
}

/**
 * The review window: `days` ending at the start of the month after `month` — a month of the plant
 * calendar (tenant `calendar_system`: `1405-12` is Esfand on a Persian plant) — at local midnight in the
 * plant time zone.
 */
export async function reviewWindow(
  manager: EntityManager,
  input: { tenantId: string; month: string; days: number },
): Promise<{ from: Date; to: Date; calendar: PlantCalendar }> {
  const [tenant] = await manager.query<
    Array<{ tz: string; calendar: string | null }>
  >(
    `SELECT COALESCE(t."timezone", 'UTC') AS "tz", t."calendar_system" AS "calendar"
       FROM "tenants" t WHERE t."id"::text = $1::text`,
    [input.tenantId],
  );
  const calendar: PlantCalendar =
    tenant?.calendar === 'persian' ? 'persian' : 'gregorian';
  const dates = plantMonthDates(input.month, calendar);
  if (!dates) throw invalid('INVALID_MONTH', 'month must be YYYY-MM');
  const [row] = await manager.query<Array<{ from: Date; to: Date }>>(
    `SELECT ($1::date::timestamp AT TIME ZONE $2::text) - make_interval(days => $3::int) AS "from",
            $1::date::timestamp AT TIME ZONE $2::text AS "to"`,
    [dates.next, tenant?.tz ?? 'UTC', input.days],
  );
  return { from: new Date(row.from), to: new Date(row.to), calendar };
}
