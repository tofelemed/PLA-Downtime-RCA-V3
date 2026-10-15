import { EntityManager } from 'typeorm';
import {
  ImpactBasis,
  ImpactRule,
  ImpactSubject,
  StandbyRun,
  UnitImpactMode,
} from '../domain/reliability/unit-impact';

/** A live equipment stop the impact resolver handles. */
export interface ImpactEvent extends ImpactSubject {
  id: string;
  tenantId: string;
  unitId: string;
  assetId: string;
}

interface EventRow {
  id: string;
  tenant_id: string;
  unit_id: string;
  asset_id: string;
  start_time: Date;
  end_time: Date | null;
  impact_mode: string;
  impact_fraction: string | number | null;
  impact_basis: ImpactBasis;
}

const EVENT_COLUMNS = `e."id", e."tenant_id", e."unit_id", e."asset_id", e."start_time", e."end_time",
       e."impact_mode"::text AS "impact_mode", e."impact_fraction", e."impact_basis"`;

const LIVE_STOP = `e."physical_type" = 'downtime' AND e."physical_state" IN ('open', 'closed')
   AND e."asset_id" IS NOT NULL`;

function eventOf(row: EventRow): ImpactEvent {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    unitId: row.unit_id,
    assetId: row.asset_id,
    start: new Date(row.start_time),
    end: row.end_time ? new Date(row.end_time) : null,
    impactMode: row.impact_mode,
    impactFraction:
      row.impact_fraction === null ? null : String(row.impact_fraction),
    impactBasis: row.impact_basis,
  };
}

/** The event when it is a live downtime event with an asset; null otherwise. */
export async function loadImpactEvent(
  manager: EntityManager,
  tenantId: string,
  eventId: string,
): Promise<ImpactEvent | null> {
  const [row]: EventRow[] = await manager.query(
    `SELECT ${EVENT_COLUMNS} FROM "production_events" e
      WHERE e."id" = $1 AND e."tenant_id" = $2 AND ${LIVE_STOP}`,
    [eventId, tenantId],
  );
  return row ? eventOf(row) : null;
}

export interface AssetWindow {
  tenantId: string;
  unitId: string;
  assetId: string;
  from: Date;
  /** null = open-ended */
  to: Date | null;
}

/**
 * One keyset page (start, id) of the asset's live stops of the unit starting in `[from, to)` — the rule
 * in force at a stop's start decides its impact. Uses IDX_production_events_tenant_asset_start.
 */
export async function loadImpactEventPage(
  manager: EntityManager,
  window: AssetWindow,
  after: { start: Date; id: string } | null,
  limit: number,
): Promise<ImpactEvent[]> {
  const rows: EventRow[] = await manager.query(
    `SELECT ${EVENT_COLUMNS} FROM "production_events" e
      WHERE e."tenant_id" = $1 AND e."asset_id" = $2 AND e."unit_id" = $3 AND ${LIVE_STOP}
        AND e."start_time" >= $4 AND ($5::timestamptz IS NULL OR e."start_time" < $5)
        AND ($6::timestamptz IS NULL OR (e."start_time", e."id") > ($6::timestamptz, $7::uuid))
      ORDER BY e."start_time", e."id" LIMIT $8`,
    [
      window.tenantId,
      window.assetId,
      window.unitId,
      window.from,
      window.to,
      after?.start ?? null,
      after?.id ?? null,
      limit,
    ],
  );
  return rows.map(eventOf);
}

interface RuleRow {
  id: string;
  version: number;
  mode: UnitImpactMode;
  fraction: string | number | null;
  standby_asset_id: string | null;
  takeover_seconds: number;
}

/** The approved rule of (unit, asset) in force at `at`. Uses IDX_unit_impact_rules_tenant_unit_asset. */
export async function loadImpactRule(
  manager: EntityManager,
  event: ImpactEvent,
): Promise<ImpactRule | null> {
  const [row]: RuleRow[] = await manager.query(
    `SELECT "id", "version", "mode", "fraction", "standby_asset_id", "takeover_seconds"
       FROM "unit_impact_rules"
      WHERE "tenant_id" = $1 AND "unit_id" = $2 AND "asset_id" = $3 AND "state" = 'approved'
        AND "effective_from" <= $4 AND ("effective_to" IS NULL OR "effective_to" > $4)
      ORDER BY "version" DESC LIMIT 1`,
    [event.tenantId, event.unitId, event.assetId, event.start],
  );
  if (!row) return null;
  return {
    id: row.id,
    version: row.version,
    mode: row.mode,
    fraction: row.fraction === null ? null : String(row.fraction),
    standbyAssetId: row.standby_asset_id,
    takeoverSeconds: row.takeover_seconds,
  };
}

/** Runs of the rule's standby starting in the takeover window. Uses IDX_standby_records_tenant_asset_start. */
export async function loadTakeoverRuns(
  manager: EntityManager,
  event: ImpactEvent,
  rule: ImpactRule,
): Promise<StandbyRun[]> {
  if (!rule.standbyAssetId) return [];
  const latest = new Date(event.start.getTime() + rule.takeoverSeconds * 1000);
  const rows: Array<{
    id: string;
    started_at: Date;
    ended_at: Date | null;
    outcome: string;
  }> = await manager.query(
    `SELECT "id", "started_at", "ended_at", "outcome" FROM "standby_records"
      WHERE "tenant_id" = $1 AND "asset_id" = $2 AND "record_kind" = 'run'
        AND "started_at" >= $3 AND "started_at" <= $4`,
    [event.tenantId, rule.standbyAssetId, event.start, latest],
  );
  return rows.map((r) => ({
    id: r.id,
    start: new Date(r.started_at),
    end: r.ended_at ? new Date(r.ended_at) : null,
    outcome: r.outcome,
  }));
}

/** Approved rules naming `standbyAssetId` as their standby and overlapping `[from, to)`. */
export async function loadRulesOfStandby(
  manager: EntityManager,
  input: {
    tenantId: string;
    standbyAssetId: string;
    from: Date;
    to: Date | null;
  },
): Promise<
  Array<{ unitId: string; assetId: string; takeoverSeconds: number }>
> {
  const rows: Array<{
    unit_id: string;
    asset_id: string;
    takeover_seconds: number;
  }> = await manager.query(
    `SELECT DISTINCT "unit_id", "asset_id", "takeover_seconds" FROM "unit_impact_rules"
      WHERE "tenant_id" = $1 AND "standby_asset_id" = $2 AND "state" = 'approved'
        AND ("effective_to" IS NULL OR "effective_to" > $3)
        AND ($4::timestamptz IS NULL OR "effective_from" < $4)`,
    [input.tenantId, input.standbyAssetId, input.from, input.to],
  );
  return rows.map((r) => ({
    unitId: r.unit_id,
    assetId: r.asset_id,
    takeoverSeconds: r.takeover_seconds,
  }));
}
