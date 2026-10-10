import { EntityManager } from 'typeorm';

/** Approved historical loss of a set of events or loss lines (RCA02 / RCA03), from the ledger only. */
export interface ApprovedImpact {
  /** active loss lines of the latest approved revision of their period */
  lines: number;
  quantities: Array<{ kind: string; uom: string | null; quantity: string }>;
  /**
   * contribution-margin value per reporting currency; `amount` null when any line is not valued or
   * lacks an FX rate (never estimated, D08)
   */
  values: Array<{
    currency: string;
    amount: string | null;
    valuedLines: number;
    unvaluedLines: number;
  }>;
  basis: string;
}

export const APPROVED_IMPACT_BASIS =
  'loss lines of the latest approved revision of each period (current run, active, loss kinds only); ' +
  'contribution margin view; draft and in-review figures are never included';

/** Loss kinds that lower output (the loss tree's kinds; gains and residuals stay apart). */
const LOSS_KINDS = [
  'schedule_exclusion',
  'availability',
  'performance',
  'quality',
  'bridge',
  'unaccounted_classified',
];

/** Lines of the latest approved revision per period, filtered by `$2` (event ids or line ids). */
const APPROVED_LINES = (filter: 'event' | 'line') => `
  WITH cand AS (
    SELECT l."id", l."run_id", l."period_id", l."kind"::text AS "kind", l."uom", l."quantity"
      FROM "loss_lines" l
     WHERE l."tenant_id" = $1 AND ${filter === 'event' ? 'l."cause_event_id"' : 'l."id"'} = ANY($2::uuid[])
       AND l."state" = 'active' AND l."source" <> 'candidate_superseded' AND l."kind"::text = ANY($3::text[])),
  approved AS (
    SELECT c.* FROM cand c
     WHERE c."run_id" = (SELECT ar."current_run_id" FROM "accounting_revisions" ar
                          WHERE ar."tenant_id" = $1 AND ar."period_id" = c."period_id" AND ar."lifecycle" = 'approved'
                          ORDER BY ar."revision" DESC LIMIT 1))`;

export async function approvedImpact(
  manager: EntityManager,
  tenantId: string,
  target: { eventIds?: string[]; lineIds?: string[] },
): Promise<ApprovedImpact> {
  const filter = target.lineIds ? 'line' : 'event';
  const ids = target.lineIds ?? target.eventIds ?? [];
  const empty = {
    lines: 0,
    quantities: [],
    values: [],
    basis: APPROVED_IMPACT_BASIS,
  };
  if (ids.length === 0) return empty;
  const params = [tenantId, ids, LOSS_KINDS];
  const quantities: Array<{
    kind: string;
    uom: string | null;
    quantity: string;
    lines: number;
  }> = await manager.query(
    `${APPROVED_LINES(filter)}
       SELECT a."kind", a."uom", sum(a."quantity")::text AS "quantity", count(*)::int AS "lines"
         FROM approved a GROUP BY 1, 2 ORDER BY 1, 2`,
    params,
  );
  const values: Array<{
    currency: string;
    amount: string | null;
    valued: number;
    unvalued: number;
  }> = await manager.query(
    `${APPROVED_LINES(filter)}
       SELECT v."currency",
              CASE WHEN bool_and(v."status" = 'valued' AND v."amount" IS NOT NULL) THEN sum(v."amount")::text END AS "amount",
              count(*) FILTER (WHERE v."status" = 'valued' AND v."amount" IS NOT NULL)::int AS "valued",
              count(*) FILTER (WHERE NOT (v."status" = 'valued' AND v."amount" IS NOT NULL))::int AS "unvalued"
         FROM approved a
         JOIN "loss_line_valuations" v ON v."tenant_id" = $1 AND v."run_id" = a."run_id" AND v."loss_line_id" = a."id"
          AND v."view" = 'contribution_margin'
        GROUP BY 1 ORDER BY 1`,
    params,
  );
  return {
    lines: quantities.reduce((sum, row) => sum + row.lines, 0),
    quantities: quantities.map(({ kind, uom, quantity }) => ({
      kind,
      uom,
      quantity,
    })),
    values: values.map((row) => ({
      currency: row.currency,
      amount: row.amount,
      valuedLines: row.valued,
      unvaluedLines: row.unvalued,
    })),
    basis: APPROVED_IMPACT_BASIS,
  };
}
