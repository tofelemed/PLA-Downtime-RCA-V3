import { EntityManager } from 'typeorm';
import { AdjustmentTotal, MATERIAL_KINDS } from '../domain/close/materiality';

/** How many open items a month close view lists (the counts are always complete). */
export const PREREQUISITE_LIST_LIMIT = 50;

export interface PendingPeriod {
  periodId: string;
  unitId: string;
  unitName: string | null;
  localDate: string;
  shiftName: string | null;
  /** latest revision's lifecycle (`none` = never reconciled; `stale` = in review with changed inputs) */
  workflow: string;
}

export interface OpenProposal {
  proposalId: string;
  periodId: string;
  unitId: string;
  localDate: string;
  trigger: string;
  createdAt: string;
}

export interface MonthPrerequisites {
  /** periods of the month that need an approved revision */
  periods: number;
  approved: number;
  pendingCount: number;
  pending: PendingPeriod[];
  openProposalCount: number;
  openProposals: OpenProposal[];
}

export interface MonthDates {
  tenantId: string;
  firstDate: string;
  endDate: string;
}

/**
 * Periods of the month by operational date with their latest revision that is not cancelled; an excluded
 * period that was never reconciled needs no approval. $1 tenant, $2 first date, $3 end date (exclusive).
 * Uses IDX_production_periods_tenant_date and UQ_accounting_revisions_period_revision.
 */
const MONTH_PERIODS = `WITH m AS (
  SELECT p."id", p."unit_id", p."local_date", p."shift_name", p."utc_start",
         CASE WHEN r."lifecycle" IS NULL THEN 'none'
              WHEN r."lifecycle" = 'in_review' AND r."is_stale" THEN 'stale'
              ELSE r."lifecycle"::text END AS "workflow"
    FROM "production_periods" p
    LEFT JOIN LATERAL (SELECT ar."lifecycle", ar."is_stale" FROM "accounting_revisions" ar
                        WHERE ar."period_id" = p."id" AND ar."lifecycle" <> 'cancelled'
                        ORDER BY ar."revision" DESC LIMIT 1) r ON true
   WHERE p."tenant_id" = $1 AND p."local_date" >= $2 AND p."local_date" < $3
     AND NOT (p."is_excluded" AND r."lifecycle" IS NULL))`;

const paramsOf = (month: MonthDates) => [
  month.tenantId,
  month.firstDate,
  month.endDate,
];

async function periodCounts(
  manager: EntityManager,
  month: MonthDates,
): Promise<{ periods: number; approved: number }> {
  const [row]: Array<{ periods: number; approved: number }> =
    await manager.query(
      `${MONTH_PERIODS} SELECT count(*)::int AS "periods",
              count(*) FILTER (WHERE "workflow" = 'approved')::int AS "approved" FROM m`,
      paramsOf(month),
    );
  return row;
}

async function pendingPeriods(
  manager: EntityManager,
  month: MonthDates,
): Promise<PendingPeriod[]> {
  const rows: Array<Record<string, string | null>> = await manager.query(
    `${MONTH_PERIODS}
     SELECT m."id", m."unit_id", u."name" AS "unit_name", to_char(m."local_date", 'YYYY-MM-DD') AS "local_date",
            m."shift_name", m."workflow"
       FROM m LEFT JOIN "units" u ON u."id" = m."unit_id"
      WHERE m."workflow" <> 'approved'
      ORDER BY m."local_date", m."utc_start", m."id" LIMIT ${PREREQUISITE_LIST_LIMIT}`,
    paramsOf(month),
  );
  return rows.map((r) => ({
    periodId: r.id as string,
    unitId: r.unit_id as string,
    unitName: r.unit_name,
    localDate: r.local_date as string,
    shiftName: r.shift_name,
    workflow: r.workflow as string,
  }));
}

const OPEN_PROPOSALS = `FROM "period_change_proposals" cp
  JOIN "production_periods" p ON p."id" = cp."period_id"
 WHERE cp."tenant_id" = $1 AND cp."state" = 'open' AND p."local_date" >= $2 AND p."local_date" < $3`;

async function openProposals(
  manager: EntityManager,
  month: MonthDates,
): Promise<{ count: number; items: OpenProposal[] }> {
  const [{ count }]: Array<{ count: number }> = await manager.query(
    `SELECT count(*)::int AS "count" ${OPEN_PROPOSALS}`,
    paramsOf(month),
  );
  const rows: Array<Record<string, string>> = count
    ? await manager.query(
        `SELECT cp."id", cp."period_id", cp."unit_id", to_char(p."local_date", 'YYYY-MM-DD') AS "local_date",
                cp."trigger"::text AS "trigger", cp."created_at"
           ${OPEN_PROPOSALS} ORDER BY cp."created_at", cp."id" LIMIT ${PREREQUISITE_LIST_LIMIT}`,
        paramsOf(month),
      )
    : [];
  return {
    count,
    items: rows.map((r) => ({
      proposalId: r.id,
      periodId: r.period_id,
      unitId: r.unit_id,
      localDate: r.local_date,
      trigger: r.trigger,
      createdAt: new Date(r.created_at).toISOString(),
    })),
  };
}

/** Every period of the month approved, and the change proposals still open (SME R4 prerequisites). */
export async function monthPrerequisites(
  manager: EntityManager,
  month: MonthDates,
): Promise<MonthPrerequisites> {
  const counts = await periodCounts(manager, month);
  const pending =
    counts.periods > counts.approved
      ? await pendingPeriods(manager, month)
      : [];
  const proposals = await openProposals(manager, month);
  return {
    ...counts,
    pendingCount: counts.periods - counts.approved,
    pending,
    openProposalCount: proposals.count,
    openProposals: proposals.items,
  };
}

/**
 * Σ |quantity| per unit of measure of the adjustment lines (bridge, classified Unaccounted, tolerance
 * adjustment) in the published approved revision of each period of the month (SME R1 materiality).
 */
export async function adjustmentTotals(
  manager: EntityManager,
  month: MonthDates,
): Promise<AdjustmentTotal[]> {
  const rows: Array<{ uom: string | null; quantity: string }> =
    await manager.query(
      `SELECT l."uom", sum(abs(l."quantity"))::text AS "quantity"
         FROM "production_periods" p
         JOIN LATERAL (SELECT ar."id" FROM "accounting_revisions" ar
                        WHERE ar."period_id" = p."id" AND ar."lifecycle" = 'approved'
                        ORDER BY ar."revision" DESC LIMIT 1) pub ON true
         JOIN "approved_loss_lines" l ON l."tenant_id" = $1 AND l."revision_id" = pub."id"
        WHERE p."tenant_id" = $1 AND p."local_date" >= $2 AND p."local_date" < $3
          AND l."kind"::text = ANY($4::text[])
        GROUP BY l."uom" ORDER BY l."uom"`,
      [...paramsOf(month), [...MATERIAL_KINDS]],
    );
  return rows;
}
