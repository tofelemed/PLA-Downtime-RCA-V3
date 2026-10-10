import { EntityManager } from 'typeorm';
import { bookkeepingPresent } from '../remediation/plan-filter';

/** D06 tolerance: values closer than this are equal; anything else needs an explanation. */
export const COMPARISON_EPSILON = 1e-6;

export type ComparisonStatus = 'equal' | 'explained' | 'unexplained';

export interface ComparisonRow {
  metric: string;
  scopeKey: string;
  label: string;
  legacy: number | null;
  v2: number | null;
  delta: number | null;
  status: ComparisonStatus;
  explanation: { category: string; note: string; author: string } | null;
}

export interface ComparisonResult {
  tenantId: string;
  unitIds: string[] | null;
  rows: ComparisonRow[];
  unexplained: number;
  gate: 'pass' | 'fail';
}

interface RawPair {
  metric: string;
  scopeKey: string;
  label: string;
  legacy: unknown;
  v2: unknown;
}

interface ExplanationRow {
  metric: string;
  scopeKey: string;
  legacy: unknown;
  v2: unknown;
  category: string;
  note: string;
  author: string;
}

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function sameValue(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return a === b;
  return Math.abs(a - b) <= COMPARISON_EPSILON;
}

/** v1 rows vs rows visible to v2 for the tenant (an event whose own tenant is not its unit's is lost to v2). */
const EVENT_COUNTS = `
  SELECT 'event_count' AS "metric", 'unit:' || u."id" AS "scopeKey", 'events of unit ' || u."code" AS "label",
         count(e."id") AS "legacy", count(e."id") FILTER (WHERE e."tenant_uuid" = $1::uuid) AS "v2"
    FROM "units" u LEFT JOIN "production_events" e ON e."unit_id" = u."id"
   WHERE u."tenant_id" = $1::uuid AND ($2::uuid[] IS NULL OR u."id" = ANY($2::uuid[]))
   GROUP BY u."id", u."code" HAVING count(e."id") > 0`;

/** Per v1 plan: target, actual and losses as v1 stored them vs the v2 plan version and period views. */
const PLAN_PAIRS = `
  WITH plans AS (
    SELECT p."id", p."plan_name", p."target_quantity", p."actual_quantity", p."current_version"
      FROM "production_plans" p
     WHERE p."tenant_id" = $1::text AND ($2::uuid[] IS NULL OR p."unit_ref_id" = ANY($2::uuid[]))
  ), v2 AS (
    SELECT v."plan_id", sum(v."actual") AS "actual", sum(v."losses") AS "losses"
      FROM "production_losses_v" v WHERE v."plan_id" IN (SELECT "id" FROM plans) GROUP BY v."plan_id"
  ), v1_losses AS (
    SELECT l."plan_id", sum(l."losses") AS "losses"
      FROM "production_losses" l WHERE l."plan_id" IN (SELECT "id" FROM plans) GROUP BY l."plan_id"
  )
  SELECT m."metric", 'plan:' || p."id" AS "scopeKey", p."plan_name" AS "label", m."legacy", m."v2"
    FROM plans p
    LEFT JOIN "plan_versions" pv ON pv."plan_id" = p."id" AND pv."version" = p."current_version"
    LEFT JOIN v2 ON v2."plan_id" = p."id"
    LEFT JOIN v1_losses vl ON vl."plan_id" = p."id"
   CROSS JOIN LATERAL (VALUES
         ('plan_target', p."target_quantity"::numeric, pv."header_target"::numeric),
         ('plan_actual', p."actual_quantity"::numeric, v2."actual"::numeric),
         ('plan_losses', vl."losses"::numeric, v2."losses"::numeric)) AS m("metric", "legacy", "v2")
   WHERE m."legacy" IS NOT NULL OR m."v2" IS NOT NULL
   ORDER BY p."plan_name", m."metric"`;

function classify(
  pair: RawPair,
  explanations: ExplanationRow[],
): ComparisonRow {
  const legacy = toNumber(pair.legacy);
  const v2 = toNumber(pair.v2);
  const delta = legacy !== null && v2 !== null ? v2 - legacy : null;
  const base = {
    metric: pair.metric,
    scopeKey: pair.scopeKey,
    label: pair.label,
    legacy,
    v2,
    delta,
  };
  if (sameValue(legacy, v2))
    return { ...base, status: 'equal', explanation: null };
  const match = explanations.find(
    (e) =>
      e.metric === pair.metric &&
      e.scopeKey === pair.scopeKey &&
      sameValue(toNumber(e.legacy), legacy) &&
      sameValue(toNumber(e.v2), v2),
  );
  if (!match) return { ...base, status: 'unexplained', explanation: null };
  const { category, note, author } = match;
  return {
    ...base,
    status: 'explained',
    explanation: { category, note, author },
  };
}

async function loadExplanations(
  manager: EntityManager,
  tenantId: string,
): Promise<ExplanationRow[]> {
  if (!(await bookkeepingPresent(manager))) return [];
  return manager.query(
    `SELECT "metric", "scope_key" AS "scopeKey", "legacy_value" AS "legacy", "v2_value" AS "v2",
            "category", "note", "author"
       FROM "migration_explanations" WHERE "tenant_id" = $1 ORDER BY "created_at" DESC`,
    [tenantId],
  );
}

/**
 * MIG04 comparison for a tenant (optionally limited to pilot units): event counts per unit and, per v1
 * plan, target / actual / losses against the v2 plan version and the `production_losses_v`
 * compatibility view. Every difference beyond epsilon needs a recorded explanation for exactly those
 * two values; one unexplained difference fails the gate. Read-only; no balancing adjustment exists.
 */
export async function compareScope(
  manager: EntityManager,
  scope: { tenantId: string; unitIds: string[] | null },
): Promise<ComparisonResult> {
  const params = [scope.tenantId, scope.unitIds];
  const eventPairs: RawPair[] = await manager.query(EVENT_COUNTS, params);
  const planPairs: RawPair[] = await manager.query(PLAN_PAIRS, params);
  const pairs = [...eventPairs, ...planPairs];
  const explanations = await loadExplanations(manager, scope.tenantId);
  const rows = pairs.map((pair) => classify(pair, explanations));
  const unexplained = rows.filter((row) => row.status === 'unexplained').length;
  return {
    tenantId: scope.tenantId,
    unitIds: scope.unitIds,
    rows,
    unexplained,
    gate: unexplained === 0 ? 'pass' : 'fail',
  };
}
