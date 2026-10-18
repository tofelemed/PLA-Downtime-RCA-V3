import { EntityManager } from 'typeorm';
import { PolicyKind } from './entities/accounting-policy.entity';
import {
  assertAfterApprovedHistory,
  Backdate,
  backdateOverlapsCalculation,
  CalculatedPeriod,
} from './policy-backdate';

/** Periods named in a refusal; the total is always reported. */
export const LISTED_PERIODS = 20;

export interface BackdateScope {
  tenantId: string;
  kind: PolicyKind;
  /** `tenant` or the unit id (one version sequence per kind and scope) */
  scopeKey: string;
  /** null = plant-wide: every unit of the tenant is affected */
  unitId: string | null;
}

export interface PeriodRow {
  period_id: string;
  unit_id: string;
  unit_name: string;
  local_date: string;
  shift_name: string | null;
  utc_start: Date;
  utc_end: Date;
  total: number;
}

/**
 * Commissioning backdate checks against the database (owner, 18 Oct 2026), run under the scope's version
 * lock: the instant follows the latest approved version of the scope (409 BACKDATE_REWRITES_HISTORY) and
 * no calculated period of the affected unit(s) overlaps [effectiveFrom, now) (409 BACKDATE_OVERLAPS_CALCULATION).
 */
export async function assertBackdateAllowed(
  manager: EntityManager,
  scope: BackdateScope,
  backdate: Backdate,
  now: Date,
): Promise<void> {
  assertAfterApprovedHistory(
    await latestApprovedFrom(manager, scope),
    backdate,
  );
  const rows = await calculatedPeriods(
    manager,
    scope,
    backdate.effectiveFrom,
    now,
  );
  if (rows.length === 0) return;
  throw backdateOverlapsCalculation(rows.map(toPeriod), Number(rows[0].total));
}

/** The instant a new version takes effect: `now`, or the backdate once the checks above pass. */
export async function effectiveFromOf(
  manager: EntityManager,
  scope: BackdateScope,
  backdate: Backdate | null,
  now: Date,
): Promise<Date> {
  if (!backdate) return now;
  await assertBackdateAllowed(manager, scope, backdate, now);
  return backdate.effectiveFrom;
}

export async function latestApprovedFrom(
  manager: EntityManager,
  scope: BackdateScope,
): Promise<Date | null> {
  const [row] = await manager.query<Array<{ latest: Date | null }>>(
    `SELECT max("effective_from") AS "latest" FROM "accounting_policies"
      WHERE "tenant_id" = $1 AND "policy_kind" = $2 AND "scope_key" = $3 AND "approved_at" IS NOT NULL`,
    [scope.tenantId, scope.kind, scope.scopeKey],
  );
  return row?.latest ? new Date(row.latest) : null;
}

/** Periods of the unit (or tenant) overlapping [from, to) with a non-failed calculation run or an approved revision. */
function calculatedPeriods(
  manager: EntityManager,
  scope: BackdateScope,
  from: Date,
  to: Date,
): Promise<PeriodRow[]> {
  return manager.query<PeriodRow[]>(
    `SELECT p."id" AS "period_id", p."unit_id", u."name" AS "unit_name", p."local_date"::text AS "local_date",
            p."shift_name", p."utc_start", p."utc_end", count(*) OVER () AS "total"
       FROM "production_periods" p
       JOIN "units" u ON u."id" = p."unit_id"
      WHERE p."tenant_id" = $1 AND ($2::uuid IS NULL OR p."unit_id" = $2::uuid)
        AND p."utc_start" < $4 AND p."utc_end" > $3
        AND (EXISTS (SELECT 1 FROM "calculation_runs" r WHERE r."period_id" = p."id" AND r."status" <> 'failed')
          OR EXISTS (SELECT 1 FROM "accounting_revisions" a WHERE a."period_id" = p."id" AND a."approved_at" IS NOT NULL))
      ORDER BY p."utc_start", p."id"
      LIMIT ${LISTED_PERIODS}`,
    [scope.tenantId, scope.unitId, from, to],
  );
}

export const toPeriod = (row: PeriodRow): CalculatedPeriod => ({
  periodId: row.period_id,
  unitId: row.unit_id,
  unitName: row.unit_name,
  localDate: row.local_date,
  shiftName: row.shift_name,
  utcStart: new Date(row.utc_start),
  utcEnd: new Date(row.utc_end),
});
