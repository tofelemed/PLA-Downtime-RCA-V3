import { EntityManager } from 'typeorm';
import { Dec, formatDec } from '../../domain/actuals/decimal';
import { ReportScope } from '../reports/report-scope';

export const RESTATEMENT_LIMIT = 200;

/** One approved revision that restated an earlier approved one of a period in the window (R3). */
export interface RestatementRowView {
  periodId: string;
  unitId: string;
  unitName: string | null;
  localDate: string;
  shiftName: string | null;
  revision: number;
  approvedAt: string | null;
  /** approved after the period's month was closed (SME R5 restatement) */
  afterClose: boolean;
  /** finance's posting decision, null while none is recorded */
  treatment: string | null;
  postingDate: string | null;
  uom: string | null;
  /** good output on the capacity ledger before and after, and the difference (decimal strings) */
  goodBefore: string | null;
  goodAfter: string | null;
  goodDelta: string | null;
}

export interface RestatementsView {
  rows: RestatementRowView[];
  truncated: boolean;
}

interface Row {
  period_id: string;
  unit_id: string;
  unit_name: string | null;
  local_date: string;
  shift_name: string | null;
  revision: number;
  approved_at: Date | null;
  after_close: boolean;
  treatment: string | null;
  posting_date: string | null;
  uom: string | null;
  good_before: string | null;
  good_after: string | null;
}

const goodOf = (
  run: string,
) => `(SELECT max(t."uom") AS "uom", sum(t."good_qty") AS "good"
    FROM "period_ledger_totals" t WHERE t."run_id" = ${run} AND t."tenant_id" = $1 AND t."ledger" = 'capacity')`;

/**
 * Approved revisions superseding an approved revision, of periods of the units starting in [from, to), newest
 * first: $1 tenant, $2 units, $3 from, $4 to, $5 limit + 1 (UQ_production_periods_unit_start,
 * UQ_accounting_revisions_period_revision).
 */
const SQL = `SELECT p."id"::text AS "period_id", p."unit_id"::text AS "unit_id", u."name" AS "unit_name",
       to_char(p."local_date", 'YYYY-MM-DD') AS "local_date", p."shift_name", r."revision", r."approved_at",
       r."after_close", rp."treatment", to_char(rp."posting_date", 'YYYY-MM-DD') AS "posting_date",
       coalesce(af."uom", bf."uom") AS "uom", bf."good"::text AS "good_before", af."good"::text AS "good_after"
  FROM "production_periods" p
  JOIN "accounting_revisions" r ON r."period_id" = p."id" AND r."tenant_id" = $1 AND r."lifecycle" = 'approved'
  JOIN "accounting_revisions" prev ON prev."id" = r."supersedes_id" AND prev."tenant_id" = $1
  LEFT JOIN "units" u ON u."id" = p."unit_id"
  LEFT JOIN "restatement_postings" rp ON rp."revision_id" = r."id" AND rp."tenant_id" = $1
  LEFT JOIN LATERAL ${goodOf('prev."current_run_id"')} bf ON true
  LEFT JOIN LATERAL ${goodOf('r."current_run_id"')} af ON true
 WHERE p."tenant_id" = $1 AND p."unit_id" = ANY($2::uuid[]) AND p."utc_start" >= $3 AND p."utc_start" < $4
 ORDER BY r."approved_at" DESC NULLS LAST, p."local_date" DESC, p."id"
 LIMIT $5`;

const dec = (value: string | null) =>
  value === null ? null : formatDec(new Dec(value));

export function toRestatementRow(r: Row): RestatementRowView {
  const before = dec(r.good_before);
  const after = dec(r.good_after);
  return {
    periodId: r.period_id,
    unitId: r.unit_id,
    unitName: r.unit_name,
    localDate: r.local_date,
    shiftName: r.shift_name,
    revision: r.revision,
    approvedAt: r.approved_at?.toISOString() ?? null,
    afterClose: r.after_close,
    treatment: r.treatment,
    postingDate: r.posting_date,
    uom: r.uom,
    goodBefore: before,
    goodAfter: after,
    goodDelta:
      before === null || after === null
        ? null
        : formatDec(new Dec(after).minus(before)),
  };
}

/**
 * `GET /reports/restatements` (R3): the restatements of the window's periods — each approved revision that
 * replaced an approved one — with finance's posting decision and the change in good output.
 */
export async function restatementsReport(
  manager: EntityManager,
  scope: ReportScope,
): Promise<RestatementsView> {
  const rows: Row[] = await manager.query(SQL, [
    scope.tenantId,
    scope.unitIds,
    scope.from,
    scope.to,
    RESTATEMENT_LIMIT + 1,
  ]);
  return {
    rows: rows.slice(0, RESTATEMENT_LIMIT).map(toRestatementRow),
    truncated: rows.length > RESTATEMENT_LIMIT,
  };
}
