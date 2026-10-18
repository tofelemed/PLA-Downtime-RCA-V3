import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RequestContext } from '../common/context/request-context';
import { DefaultBasis } from '../domain/valuation/valuation.types';
import { RcaCauseReportQueryDto } from '../v2/rca/rca-case-causes-v2.dto';
import { ApprovedImpactValue } from './approved-impact';
import { approvedOf } from './rca-outcome';
import { scopeOf } from './rca-scope';

/** One catalogue cause of the recurring-cause report (item 7 groundwork). */
export interface RcaCauseReportItem {
  causeCodeId: string;
  code: string;
  name: string;
  active: boolean;
  /** cases of your scope with at least one cause of this code */
  cases: number;
  causes: number;
  /** approved loss of the events and loss lines linked to those cases, each counted once per code */
  approvedLoss: { lines: number; values: ApprovedImpactValue[] };
}

export interface RcaCauseReportV2View {
  items: RcaCauseReportItem[];
  /** valuation view of the amounts (the policy default, SME V8) and the basis of the figures */
  view: DefaultBasis | null;
  basis: string | null;
  asOf: string;
}

interface RankRow {
  cause_code_id: string;
  code: string;
  name: string;
  is_active: boolean;
  cases: number;
  causes: number;
  rca_ids: string[];
}

interface LinkRow {
  rca_id: string;
  link_type: string;
  target_id: string;
}

const RANK_SQL = `SELECT c."cause_code_id", cc."code", cc."name", cc."is_active",
         count(DISTINCT c."rca_id")::int AS "cases", count(*)::int AS "causes",
         array_agg(DISTINCT c."rca_id") AS "rca_ids"
    FROM "rca_causes" c
    JOIN "rcas" r ON r."id" = c."rca_id" AND r."tenant_id" = c."tenant_id"
    JOIN "rca_cause_codes" cc ON cc."id" = c."cause_code_id"
   WHERE c."tenant_id" = $1 AND c."cause_code_id" IS NOT NULL
     AND ($2::text IS NULL OR c."kind" = $2::text)
     AND ($3::uuid[] IS NULL OR r."unit_id" = ANY($3::uuid[]))
     AND ($4::uuid IS NULL OR r."unit_id" = $4::uuid)
   GROUP BY 1, 2, 3, 4
   ORDER BY "cases" DESC, "causes" DESC, cc."code"
   LIMIT $5`;

/** Amount of one currency for ordering (null = not valued, ordered last). */
function amountIn(item: RcaCauseReportItem, currency: string): number {
  const value = item.approvedLoss.values.find((v) => v.currency === currency);
  return value?.amount == null ? -Infinity : Number(value.amount);
}

/** Event and loss-line ids linked to any of `rcaIds`, each once. */
function linksOf(
  rcaIds: readonly string[],
  links: readonly LinkRow[],
): { eventIds: string[]; lineIds: string[] } {
  const cases = new Set(rcaIds);
  const ids = (type: string) => [
    ...new Set(
      links
        .filter((l) => cases.has(l.rca_id) && l.link_type === type)
        .map((l) => l.target_id),
    ),
  ];
  return { eventIds: ids('event'), lineIds: ids('loss_line') };
}

/**
 * Recurring causes (item 7 groundwork): catalogue causes ranked by the number of cases of the caller's
 * scope that name them, top `limit` (≤ 50), each with the approved loss of its cases' linked events and
 * loss lines — the case outcome's calculation (approved revisions only; null amounts when not valued,
 * never estimated). One approved-impact read per ranked code (bounded by `limit`). `sort=approvedLoss`
 * orders that top set by the amount in `currency`.
 */
@Injectable()
export class RcaCauseReportService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async report(
    context: RequestContext,
    query: RcaCauseReportQueryDto,
  ): Promise<RcaCauseReportV2View> {
    const scope = scopeOf(context);
    const ranked: RankRow[] = await this.dataSource.query(RANK_SQL, [
      scope.tenantId,
      query.kind ?? null,
      scope.units,
      query.unitId ?? null,
      query.limit ?? 20,
    ]);
    const links = await this.caseLinks(
      scope.tenantId,
      ranked.flatMap((row) => row.rca_ids),
    );
    const items: RcaCauseReportItem[] = [];
    let view: DefaultBasis | null = null;
    let basis: string | null = null;
    for (const row of ranked) {
      const impact = await approvedOf(
        this.dataSource.manager,
        scope.tenantId,
        linksOf(row.rca_ids, links),
      );
      ({ view, basis } = impact);
      items.push({
        causeCodeId: row.cause_code_id,
        code: row.code,
        name: row.name,
        active: row.is_active,
        cases: row.cases,
        causes: row.causes,
        approvedLoss: { lines: impact.lines, values: impact.values },
      });
    }
    if (query.sort === 'approvedLoss') {
      const currency = query.currency ?? 'USD';
      items.sort((a, b) => amountIn(b, currency) - amountIn(a, currency));
    }
    return { items, view, basis, asOf: new Date().toISOString() };
  }

  /** Event and loss-line links of the ranked cases, in one query. */
  private async caseLinks(
    tenantId: string,
    rcaIds: string[],
  ): Promise<LinkRow[]> {
    if (rcaIds.length === 0) return [];
    return this.dataSource.query(
      `SELECT "rca_id", "link_type"::text AS "link_type", "target_id" FROM "rca_case_links"
        WHERE "tenant_id" = $1 AND "rca_id" = ANY($2::uuid[]) AND "link_type" IN ('event', 'loss_line')`,
      [tenantId, [...new Set(rcaIds)]],
    );
  }
}
