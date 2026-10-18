import { EntityManager } from 'typeorm';
import {
  assertAfterApprovedHistory,
  backdateOverlapsApprovedValue,
} from '../periods/policy-backdate';
import {
  latestApprovedFrom,
  LISTED_PERIODS,
  PeriodRow,
  toPeriod,
} from '../periods/policy-backdate.guard';
import { ValuationBackdate } from './valuation-backdate';

/**
 * Checks of a backdated tenant-wide valuation policy version (owner, 18 Oct 2026), at creation and again
 * at approval, under the tenant's valuation-policy lock:
 * - 409 BACKDATE_REWRITES_HISTORY unless the instant follows the latest approved version's effective-from;
 * - 409 BACKDATE_OVERLAPS_APPROVED_VALUE when a period of the plant with an approved revision overlaps
 *   [effectiveFrom, now), unless the author chose `restateApproved` — then those periods are revalued only
 *   through the normal path (SME V7: queued recalculation, a change proposal per approved revision).
 * Periods without approved figures are simply revalued by the queued recalculation.
 */
export async function assertValuationBackdateAllowed(
  manager: EntityManager,
  tenantId: string,
  backdate: ValuationBackdate,
  now: Date,
): Promise<void> {
  const latest = await latestApprovedFrom(manager, {
    tenantId,
    kind: 'valuation_basis',
    scopeKey: 'tenant',
    unitId: null,
  });
  assertAfterApprovedHistory(latest, backdate);
  if (backdate.restateApproved) return;
  const rows = await approvedPeriods(
    manager,
    tenantId,
    backdate.effectiveFrom,
    now,
  );
  if (rows.length === 0) return;
  throw backdateOverlapsApprovedValue(
    rows.map(toPeriod),
    Number(rows[0].total),
  );
}

/** Periods of the tenant overlapping [from, to) that have an approved revision (approved figures and values). */
function approvedPeriods(
  manager: EntityManager,
  tenantId: string,
  from: Date,
  to: Date,
): Promise<PeriodRow[]> {
  return manager.query<PeriodRow[]>(
    `SELECT p."id" AS "period_id", p."unit_id", u."name" AS "unit_name", p."local_date"::text AS "local_date",
            p."shift_name", p."utc_start", p."utc_end", count(*) OVER () AS "total"
       FROM "production_periods" p
       JOIN "units" u ON u."id" = p."unit_id"
      WHERE p."tenant_id" = $1 AND p."utc_start" < $3 AND p."utc_end" > $2
        AND EXISTS (SELECT 1 FROM "accounting_revisions" a WHERE a."period_id" = p."id" AND a."approved_at" IS NOT NULL)
      ORDER BY p."utc_start", p."id"
      LIMIT ${LISTED_PERIODS}`,
    [tenantId, from, to],
  );
}
