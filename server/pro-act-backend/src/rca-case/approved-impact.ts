import { EntityManager } from 'typeorm';
import { DefaultBasis } from '../domain/valuation/valuation.types';
import { LOSS_VALUE_KINDS } from '../domain/valuation/reconciled-valuation';
import { defaultValuationBasis } from '../valuation/valuation-policy.store';

/** One reporting currency of the approved impact (same status semantics as the loss-value report). */
export interface ApprovedImpactValue {
  currency: string;
  /** decimal string; null when any line is not valued or lacks an FX rate (never estimated, D08) */
  amount: string | null;
  valuedLines: number;
  unvaluedLines: number;
  /** SME V7: valued lines converted with an authorised provisional FX rate */
  provisionalLines: number;
  status: 'valued' | 'unvalued' | 'mixed';
  /** SME V7: the amount includes provisional-rate conversions (revalued when the final rate is approved) */
  fxProvisional: boolean;
}

/** Approved historical loss of a set of events or loss lines (RCA02 / RCA03), from the ledger only. */
export interface ApprovedImpact {
  /** active loss lines of the latest approved revision of their period */
  lines: number;
  quantities: Array<{ kind: string; uom: string | null; quantity: string }>;
  /** the valuation view of `values`: the default basis of the tenant's approved policy unless the caller fixed it */
  view: DefaultBasis;
  values: ApprovedImpactValue[];
  basis: string;
}

const BASIS_WORDS: Readonly<Record<DefaultBasis, string>> = {
  contribution_margin: 'contribution margin view',
  standard_cost: 'standard cost view',
  economic_impact:
    'economic impact view (lost contribution on unrecovered sales + incremental costs)',
};

/**
 * Words of the figures' basis (QA M3: no internal reference, no "policy default" claim — the view is named,
 * and `source` says where it came from when it is not simply the policy's default now).
 */
export const approvedImpactBasis = (view: DefaultBasis, source?: string) =>
  'Approved plan lines of the latest approved revision of each period (decided quantities, loss kinds ' +
  `only), valued in the ${BASIS_WORDS[view]}${source ? ` (${source})` : ''}; draft and in-review figures ` +
  'are never included';

/**
 * Loss kinds that lower output — the same set as the loss-value report (VA-01): schedule exclusions are
 * time taken out of the schedule, not a loss; gains and residuals stay apart.
 */
const LOSS_KINDS = [...LOSS_VALUE_KINDS];

/** Latest approved revision of a period (`$1` tenant). */
const LATEST = (
  period: string,
) => `(SELECT ar."id" FROM "accounting_revisions" ar
   WHERE ar."tenant_id" = $1 AND ar."period_id" = ${period} AND ar."lifecycle" = 'approved'
   ORDER BY ar."revision" DESC LIMIT 1)`;

/**
 * Lines of the latest approved revision per period, filtered by `$2` (event ids or line ids): the approved
 * plan lines (VA-01b: decided quantities, manual lines with their evidence event), or — for revisions
 * approved before they were stored — the active plan-ledger loss lines of the approved run (the capacity
 * ledger is an alternative baseline of the same loss and is never added on top).
 */
const APPROVED_LINES = (filter: 'event' | 'line') => `
  WITH cand AS (
    SELECT l."id", l."run_id", l."period_id", l."kind"::text AS "kind", l."uom", l."quantity"
      FROM "loss_lines" l
     WHERE l."tenant_id" = $1 AND ${filter === 'event' ? 'l."cause_event_id"' : 'l."id"'} = ANY($2::uuid[])
       AND l."ledger" = 'plan' AND l."state" = 'active' AND l."source" <> 'candidate_superseded'
       AND l."kind"::text = ANY($3::text[])),
  approved AS (
    SELECT a."id", 'approved' AS "origin", a."kind"::text AS "kind", a."uom", a."quantity"
      FROM "approved_loss_lines" a
     WHERE a."tenant_id" = $1 AND ${filter === 'event' ? 'a."cause_event_id"' : 'a."source_id"'} = ANY($2::uuid[])
       AND a."kind"::text = ANY($3::text[]) AND a."revision_id" = ${LATEST('a."period_id"')}
    UNION ALL
    SELECT c."id", 'run', c."kind", c."uom", c."quantity" FROM cand c
     WHERE c."run_id" = (SELECT ar."current_run_id" FROM "accounting_revisions" ar WHERE ar."id" = ${LATEST('c."period_id"')})
       AND NOT EXISTS (SELECT 1 FROM "approved_loss_lines" x WHERE x."revision_id" = ${LATEST('c."period_id"')}))`;

const VALUES_SQL = (filter: 'event' | 'line') => `${APPROVED_LINES(filter)}
       SELECT v."currency",
              CASE WHEN bool_and(v."status" = 'valued' AND v."amount" IS NOT NULL) THEN sum(v."amount")::text END AS "amount",
              count(*) FILTER (WHERE v."status" = 'valued' AND v."amount" IS NOT NULL)::int AS "valued",
              count(*) FILTER (WHERE NOT (v."status" = 'valued' AND v."amount" IS NOT NULL))::int AS "unvalued",
              count(*) FILTER (WHERE v."status" = 'valued' AND v."amount" IS NOT NULL AND v."provisional")::int AS "provisional"
         FROM approved a
         JOIN LATERAL (
           SELECT lv."currency", lv."amount", lv."status"::text AS "status", lv."provisional" FROM "loss_line_valuations" lv
            WHERE a."origin" = 'run' AND lv."tenant_id" = $1 AND lv."loss_line_id" = a."id" AND lv."view" = $4::valuation_view
           UNION ALL
           SELECT av."currency", av."amount", av."status", av."provisional" FROM "approved_loss_line_valuations" av
            WHERE a."origin" = 'approved' AND av."tenant_id" = $1 AND av."approved_line_id" = a."id"
              AND av."view" = $4::valuation_view
         ) v ON true
        GROUP BY 1 ORDER BY 1`;

interface ValueRow {
  currency: string;
  amount: string | null;
  valued: number;
  unvalued: number;
  provisional: number;
}

function valueOf(row: ValueRow): ApprovedImpactValue {
  return {
    currency: row.currency,
    amount: row.amount,
    valuedLines: row.valued,
    unvaluedLines: row.unvalued,
    provisionalLines: row.provisional,
    status:
      row.valued === 0 ? 'unvalued' : row.unvalued === 0 ? 'valued' : 'mixed',
    fxProvisional: row.provisional > 0,
  };
}

/**
 * Approved impact of events or lines: quantities per kind and unit of measure, and the value of one
 * valuation view per currency — by default the policy's default basis (SME V8: economic impact from
 * policy version 3, contribution margin while none is approved).
 */
export async function approvedImpact(
  manager: EntityManager,
  tenantId: string,
  target: {
    eventIds?: string[];
    lineIds?: string[];
    view?: DefaultBasis;
    /** where a fixed `view` comes from, named in the basis */
    viewSource?: string;
  },
): Promise<ApprovedImpact> {
  const filter = target.lineIds ? 'line' : 'event';
  const ids = target.lineIds ?? target.eventIds ?? [];
  const view = target.view ?? (await defaultValuationBasis(manager, tenantId));
  const basis = approvedImpactBasis(view, target.view && target.viewSource);
  if (ids.length === 0)
    return { lines: 0, quantities: [], view, values: [], basis };
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
  const values: ValueRow[] = await manager.query(VALUES_SQL(filter), [
    ...params,
    view,
  ]);
  return {
    lines: quantities.reduce((sum, row) => sum + row.lines, 0),
    quantities: quantities.map(({ kind, uom, quantity }) => ({
      kind,
      uom,
      quantity,
    })),
    view,
    values: values.map(valueOf),
    basis,
  };
}
