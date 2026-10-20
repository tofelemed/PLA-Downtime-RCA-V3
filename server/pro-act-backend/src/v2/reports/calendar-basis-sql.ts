import { EntityManager } from 'typeorm';
import { LossEvent } from '../../domain/accounting/accounting.types';
import { CalendarPolicy } from '../../domain/kpi/calendar-basis';
import { OccurrenceSpan } from '../../domain/kpi/downtime-measures';
import { FailureSource, FailureSpan } from '../../domain/kpi/reliability';
import { BoundedInterval } from '../../domain/time/interval-algebra';
import {
  OEE_POLICY_DEFAULT,
  parseOeePolicy,
} from '../../periods/engine-policy-bodies';
import { policyBodiesInForce } from '../../periods/policy-bodies-in-force';

/** The plant's day definition: default site timezone and operational day start (UTC midnight without a site). */
export interface PlantDay {
  timezone: string;
  dayStart: string;
}

export async function loadPlantDay(
  manager: EntityManager,
  tenantId: string,
): Promise<PlantDay> {
  const [row]: Array<{ timezone: string; day_start: string }> =
    await manager.query(
      `SELECT "timezone", "operational_day_start"::text AS "day_start" FROM "sites"
        WHERE "tenant_id" = $1 AND "is_default" LIMIT 1`,
      [tenantId],
    );
  if (row) return { timezone: row.timezone, dayStart: row.day_start };
  // no default site: the tenant's own timezone (as the export labels resolve it), midnight day start
  const [tenant]: Array<{ timezone: string | null }> = await manager.query(
    `SELECT "timezone" FROM "tenants" WHERE "id" = $1`,
    [tenantId],
  );
  return { timezone: tenant?.timezone || 'UTC', dayStart: '00:00:00' };
}

/**
 * Windows of the periods the run-based figures show (same selection as `SHOWN` without filters: start in
 * the window, a draft / in-review / approved revision with a current run). Uses
 * UQ_production_periods_unit_start and UQ_accounting_revisions_period_revision.
 */
const CALCULATED_SQL = `SELECT p."unit_id", p."utc_start", p."utc_end" FROM "production_periods" p
 WHERE p."tenant_id" = $1 AND p."unit_id" = ANY($2::uuid[]) AND p."utc_start" >= $3 AND p."utc_start" < $4
   AND EXISTS (SELECT 1 FROM "accounting_revisions" ar
                WHERE ar."period_id" = p."id" AND ar."current_run_id" IS NOT NULL
                  AND ar."lifecycle" IN ('draft', 'in_review', 'approved'))`;

export async function calculatedPeriods(
  manager: EntityManager,
  key: { tenantId: string; unitIds: string[]; window: BoundedInterval },
): Promise<Map<string, BoundedInterval[]>> {
  const rows: Array<{ unit_id: string; utc_start: Date; utc_end: Date }> =
    await manager.query(CALCULATED_SQL, [
      key.tenantId,
      key.unitIds,
      key.window.start,
      key.window.end,
    ]);
  const byUnit = new Map<string, BoundedInterval[]>();
  for (const row of rows) {
    const list = byUnit.get(row.unit_id) ?? [];
    list.push({ start: new Date(row.utc_start), end: new Date(row.utc_end) });
    byUnit.set(row.unit_id, list);
  }
  return byUnit;
}

/** Live stopping downtime per unit over the window; one LATERAL lookup per unit uses IDX_production_events_unit_span. */
const EVENTS_SQL = `SELECT e.* FROM unnest($2::uuid[]) AS u("id") CROSS JOIN LATERAL (
  SELECT e."id", e."unit_id", e."occurrence_id", e."start_time", e."end_time", e."schedule_class", e."oee_component",
         e."impact_mode", e."reason_code_id", e."impact_code_id", e."failure_mode", e."asset_id", e."planned_end_time",
         e."failure_severity", a."asset_type", rc."code" AS "reason_code"
    FROM "production_events" e
    LEFT JOIN "assets" a ON a."id" = e."asset_id"
    LEFT JOIN "reason_codes" rc ON rc."id" = e."reason_code_id"
   WHERE e."tenant_id" = $1 AND e."unit_id" = u."id" AND e."physical_state" IN ('open', 'closed')
     AND e."physical_type" = 'downtime' AND e."impact_mode" NOT IN ('none', 'fractional')
     AND tstzrange(e."start_time", e."end_time", '[)') && tstzrange($3, $4, '[)')) e
 ORDER BY e."unit_id", e."start_time", e."id"`;

interface EventRow {
  id: string;
  unit_id: string;
  occurrence_id: string;
  start_time: Date;
  end_time: Date | null;
  schedule_class: string;
  oee_component: string;
  impact_mode: string;
  reason_code_id: string | null;
  impact_code_id: string | null;
  failure_mode: string | null;
  asset_id: string | null;
  planned_end_time: Date | null;
  failure_severity: string | null;
  asset_type: string | null;
  reason_code: string | null;
}

const toDate = (value: Date | null) => (value ? new Date(value) : null);

function toEvent(row: EventRow): LossEvent {
  return {
    eventId: row.id,
    revisionId: null,
    revision: null,
    occurrenceId: row.occurrence_id,
    physicalType: 'downtime',
    start: new Date(row.start_time),
    end: toDate(row.end_time),
    scheduleClass: row.schedule_class,
    oeeComponent: row.oee_component,
    impactMode: row.impact_mode,
    impactFraction: null,
    quantity: null,
    reasonCodeId: row.reason_code_id,
    impactCodeId: row.impact_code_id,
    failureMode: row.failure_mode,
    assetId: row.asset_id,
    plannedEnd: toDate(row.planned_end_time),
    assetClass: row.asset_type,
    reasonCode: row.reason_code,
    failureSeverity: row.failure_severity,
  };
}

/** What the calendar basis reads for its units: stops, occurrence extents and D13 failures. */
export interface CalendarStopInputs {
  events: Map<string, LossEvent[]>;
  occurrences: OccurrenceSpan[];
  failures: Map<string, FailureSpan[]>;
}

export interface UnitsWindow {
  tenantId: string;
  unitIds: string[];
  window: BoundedInterval;
}

function groupBy<T>(
  rows: readonly T[],
  key: (row: T) => string,
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows)
    groups.set(key(row), [...(groups.get(key(row)) ?? []), row]);
  return groups;
}

/** Occurrences with a stop or a failure work order touching the window (the KPI engine's `TOUCHING_SQL`, per unit). */
const TOUCHING_SQL = `SELECT DISTINCT t."occurrence_id" FROM unnest($2::uuid[]) AS u("id") CROSS JOIN LATERAL (
  SELECT e."occurrence_id" FROM "production_events" e
   WHERE e."tenant_id" = $1 AND e."unit_id" = u."id" AND e."physical_state" IN ('open', 'closed')
     AND (e."physical_type" = 'downtime' OR e."event_type" = 'FailureWO')
     AND tstzrange(e."start_time", e."end_time", '[)') && tstzrange($3, $4, '[)')) t`;

export async function loadCalendarStops(
  manager: EntityManager,
  key: UnitsWindow,
): Promise<CalendarStopInputs> {
  const rows: EventRow[] = await manager.query(EVENTS_SQL, [
    key.tenantId,
    key.unitIds,
    key.window.start,
    key.window.end,
  ]);
  const touching: Array<{ occurrence_id: string }> = await manager.query(
    TOUCHING_SQL,
    [key.tenantId, key.unitIds, key.window.start, key.window.end],
  );
  const ids = touching.map((t) => t.occurrence_id).sort();
  const failures = await loadFailures(manager, key, ids);
  const events = new Map(
    [...groupBy(rows, (r) => r.unit_id)].map(([unit, list]) => [
      unit,
      list.map(toEvent),
    ]),
  );
  return {
    events,
    occurrences: await loadOccurrences(manager, key.tenantId, ids),
    failures,
  };
}

/** Full extent of each stop occurrence (split children outside the window included), as the KPI engine. */
const OCCURRENCES_SQL = `SELECT e."occurrence_id", min(e."start_time") AS "start_time",
       CASE WHEN bool_or(e."end_time" IS NULL) THEN NULL ELSE max(e."end_time") END AS "end_time"
  FROM "production_events" e
 WHERE e."tenant_id" = $1 AND e."occurrence_id" = ANY($2::uuid[]) AND e."physical_type" = 'downtime'
   AND e."physical_state" IN ('open', 'closed') AND e."impact_mode" NOT IN ('none', 'fractional')
 GROUP BY e."occurrence_id" ORDER BY e."occurrence_id"`;

async function loadOccurrences(
  manager: EntityManager,
  tenantId: string,
  ids: string[],
): Promise<OccurrenceSpan[]> {
  if (ids.length === 0) return [];
  const rows: Array<{
    occurrence_id: string;
    start_time: Date;
    end_time: Date | null;
  }> = await manager.query(OCCURRENCES_SQL, [tenantId, ids]);
  return rows.map((o) => ({
    occurrenceId: o.occurrence_id,
    start: new Date(o.start_time),
    end: toDate(o.end_time),
  }));
}

/** D13 failure candidates of the stop occurrences and their repeat-stop incident (SME D5). */
const FAILURES_SQL = `SELECT f."unit_id", f."occurrence_id", f."asset_id", f."start_time", f."restored_at", f."source",
       i."id" AS "incident_id", i."start_time" AS "incident_start"
  FROM "failure_events_v" f
  LEFT JOIN "stop_incident_members" m ON m."tenant_id" = f."tenant_id" AND m."occurrence_id" = f."occurrence_id"
  LEFT JOIN "stop_incidents" i ON i."id" = m."incident_id"
 WHERE f."tenant_id" = $1 AND f."unit_id" = ANY($2::uuid[]) AND f."occurrence_id" = ANY($3::uuid[])
 ORDER BY f."unit_id", f."occurrence_id"`;

interface FailureRow {
  unit_id: string;
  occurrence_id: string;
  asset_id: string | null;
  start_time: Date;
  restored_at: Date | null;
  source: FailureSource;
  incident_id: string | null;
  incident_start: Date | null;
}

async function loadFailures(
  manager: EntityManager,
  key: UnitsWindow,
  ids: string[],
): Promise<Map<string, FailureSpan[]>> {
  if (ids.length === 0) return new Map();
  const rows: FailureRow[] = await manager.query(FAILURES_SQL, [
    key.tenantId,
    key.unitIds,
    ids,
  ]);
  const spans = rows.map((f) => ({
    unitId: f.unit_id,
    span: {
      occurrenceId: f.occurrence_id,
      assetId: f.asset_id,
      start: new Date(f.start_time),
      end: toDate(f.restored_at),
      source: f.source,
      repairStart: null,
      repairEnd: null,
      incident:
        f.incident_id && f.incident_start
          ? { id: f.incident_id, start: new Date(f.incident_start) }
          : null,
    },
  }));
  return new Map(
    [...groupBy(spans, (s) => s.unitId)].map(([unit, list]) => [
      unit,
      list.map((s) => s.span),
    ]),
  );
}

export interface UnitCalendarPolicy {
  unitId: string;
  policy: CalendarPolicy;
  /** false = no `oee_policy` stored for the unit: the D04 defaults apply */
  stored: boolean;
}

/** Micro-stop rule and overlap sharing of the `oee_policy` in force per unit (D04 defaults when none is stored). */
export async function loadCalendarPolicies(
  manager: EntityManager,
  key: { tenantId: string; unitIds: string[]; at: Date },
): Promise<UnitCalendarPolicy[]> {
  const bodies = await policyBodiesInForce(
    manager,
    'oee_policy',
    key.unitIds.map((unitId) => ({
      tenantId: key.tenantId,
      unitId,
      at: key.at,
    })),
  );
  return key.unitIds.map((unitId, index) => {
    const body = bodies[index];
    const oee = body === undefined ? OEE_POLICY_DEFAULT : parseOeePolicy(body);
    return {
      unitId,
      stored: body !== undefined,
      policy: {
        microStopSeconds: oee.microStopSeconds,
        microStopSecondsByAssetClass: oee.microStopSecondsByAssetClass,
        tripReasonCodes: oee.tripReasonCodes,
        overlapAllocation: oee.overlapAllocation,
      },
    };
  });
}

export async function unitNames(
  manager: EntityManager,
  tenantId: string,
  unitIds: string[],
): Promise<Map<string, string>> {
  if (unitIds.length === 0) return new Map();
  const rows: Array<{ id: string; name: string }> = await manager.query(
    `SELECT "id", "name" FROM "units" WHERE "tenant_id" = $1 AND "id" = ANY($2::uuid[])`,
    [tenantId, unitIds],
  );
  return new Map(rows.map((r) => [r.id, r.name]));
}
