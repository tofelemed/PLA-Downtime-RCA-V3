import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RequestContext } from '../../common/context/request-context';
import { DefaultBasis } from '../../domain/valuation/valuation.types';
import { invalid } from '../../profiles/profile-errors';
import { namedReportUnits } from '../../v2/reports/report-scope';
import { RcaPortfolioQueryDto } from '../../v2/reports/rca-portfolio-v2.dto';
import { ApprovedImpactValue } from '../approved-impact';
import { approvedOf } from '../rca-outcome';
import { scopeOf } from '../rca-scope';
import {
  decodePortfolioCursor,
  encodePortfolioCursor,
  PortfolioPosition,
} from './portfolio-cursor';
import {
  PortfolioActionFact,
  PortfolioCaseFact,
  PortfolioFigures,
  portfolioFigures,
} from './portfolio-figures';
import {
  PORTFOLIO_ACTIONS_SQL,
  PORTFOLIO_CASES_SQL,
  PORTFOLIO_LINKS_SQL,
  PORTFOLIO_ROWS_SQL,
} from './portfolio-sql';

/** One row of the portfolio: a catalogue cause (or the Uncoded row) and the figures of its cases. */
export interface RcaPortfolioRowV2View extends PortfolioFigures {
  /** the cause code id, or `uncoded` */
  key: string;
  /** null for the Uncoded row (cases without a catalogue code of the chosen kind) */
  causeCode: { id: string; code: string; name: string; active: boolean } | null;
  /** approved loss of the cases' linked events and loss lines, in the asked currency only */
  approvedLoss: { lines: number; values: ApprovedImpactValue[] };
}

export interface RcaPortfolioV2View {
  items: RcaPortfolioRowV2View[];
  nextCursor: string | null;
  window: { from: string; to: string };
  causeKind: string;
  currency: string;
  /** valuation view and basis of the approved loss (null when the page has no row) */
  view: DefaultBasis | null;
  basis: string | null;
  note: string;
  asOf: string;
}

interface RowRecord {
  cause_code_id: string | null;
  code: string | null;
  name: string | null;
  is_active: boolean | null;
  cases: number;
  rca_ids: string[];
  sort_key: string;
  row_key: string;
}

interface ActionRecord {
  rca_id: string;
  status: string;
  overdue: boolean;
  claimed: string | null;
  claimed_currency: string | null;
  verdict: string | null;
  realized_metric: string | null;
  realized_difference: string | null;
  evaluated_at: string | null;
}

interface LinkRecord {
  rca_id: string;
  link_type: string;
  target_id: string;
}

interface PageFacts {
  cases: Map<string, PortfolioCaseFact>;
  actions: PortfolioActionFact[];
  links: LinkRecord[];
}

const MAX_DAYS = 400;
const DAY_MS = 86_400_000;

const NOTE =
  'Approved loss (ledger, approved revisions only), claimed avoided loss (action owners) and realised ' +
  'difference (verification against the baseline, in recurrences or downtime seconds) are separate figures ' +
  'with different bases; they are never added together. A case counts in every row of its codes.';

function windowOf(query: RcaPortfolioQueryDto): { from: Date; to: Date } {
  const from = new Date(query.from);
  const to = new Date(query.to);
  if (!(from < to)) throw invalid('INVALID_RANGE', 'from must be before to');
  if (to.getTime() - from.getTime() > MAX_DAYS * DAY_MS)
    throw invalid(
      'WINDOW_TOO_LARGE',
      `report at most ${MAX_DAYS} days at once`,
    );
  return { from, to };
}

function toActionFact(row: ActionRecord): PortfolioActionFact {
  return {
    rcaId: row.rca_id,
    status: row.status,
    overdue: row.overdue,
    claimed: row.claimed,
    claimedCurrency: row.claimed_currency,
    verdict: row.verdict,
    realized:
      row.realized_metric && row.realized_difference
        ? { metric: row.realized_metric, difference: row.realized_difference }
        : null,
    evaluatedAt: row.evaluated_at,
  };
}

/** Event and loss-line ids linked to any of `rcaIds`, each once (the case outcome's input). */
function linksOf(
  rcaIds: readonly string[],
  links: readonly LinkRecord[],
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

const causeCodeOf = (row: RowRecord): RcaPortfolioRowV2View['causeCode'] =>
  row.cause_code_id
    ? {
        id: row.cause_code_id,
        code: row.code ?? '',
        name: row.name ?? '',
        active: row.is_active ?? false,
      }
    : null;

const positionOf = (row: RowRecord): PortfolioPosition => ({
  cases: row.cases,
  sortKey: row.sort_key,
  rowKey: row.row_key,
});

/**
 * Loss → cause → action → outcome portfolio (item 2.1): the cases of the caller's scope opened in the
 * window, grouped by the catalogue code of their causes of one kind (root by default; an Uncoded row for
 * the rest), keyset-paged by number of cases. Per row: cases by status, the approved loss of their linked
 * events and loss lines (the case outcome's `approvedOf`, so the figures match the case and the
 * recurring-cause report), actions (same overdue rule as `GET /v2/rca-actions`), verdicts, claims in the
 * asked currency and realised differences. Facts are read once per page; the approved impact once per row.
 */
@Injectable()
export class RcaPortfolioService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async report(
    context: RequestContext,
    query: RcaPortfolioQueryDto,
  ): Promise<RcaPortfolioV2View> {
    const tenantId = scopeOf(context).tenantId;
    const window = windowOf(query);
    const limit = query.limit ?? 20;
    const rows = await this.rows(context, query, { ...window, limit });
    const page = rows.slice(0, limit);
    const currency = query.currency ?? 'USD';
    const built = await this.items(tenantId, page, currency);
    const last = page[page.length - 1];
    return {
      items: built.items,
      nextCursor:
        rows.length > limit && last
          ? encodePortfolioCursor(positionOf(last))
          : null,
      window: { from: window.from.toISOString(), to: window.to.toISOString() },
      causeKind: query.causeKind ?? 'root',
      currency,
      view: built.view,
      basis: built.basis,
      note: NOTE,
      asOf: new Date().toISOString(),
    };
  }

  /** The page's rows (one more than `limit` tells there is a next page), in the caller's units. */
  private async rows(
    context: RequestContext,
    query: RcaPortfolioQueryDto,
    page: { from: Date; to: Date; limit: number },
  ): Promise<RowRecord[]> {
    const scope = scopeOf(context);
    const named = await namedReportUnits(
      this.dataSource.manager,
      context,
      query.unitIds,
    );
    const after = decodePortfolioCursor(query.cursor);
    return this.dataSource.query<RowRecord[]>(PORTFOLIO_ROWS_SQL, [
      scope.tenantId,
      page.from,
      page.to,
      named ?? scope.units,
      query.causeKind ?? 'root',
      after?.cases ?? null,
      after?.sortKey ?? null,
      after?.rowKey ?? null,
      page.limit + 1,
    ]);
  }

  private async items(
    tenantId: string,
    page: readonly RowRecord[],
    currency: string,
  ): Promise<{
    items: RcaPortfolioRowV2View[];
    view: DefaultBasis | null;
    basis: string | null;
  }> {
    const facts = await this.facts(
      tenantId,
      page.flatMap((row) => row.rca_ids),
    );
    const items: RcaPortfolioRowV2View[] = [];
    let view: DefaultBasis | null = null;
    let basis: string | null = null;
    for (const row of page) {
      const impact = await approvedOf(
        this.dataSource.manager,
        tenantId,
        linksOf(row.rca_ids, facts.links),
      );
      ({ view, basis } = impact);
      items.push({
        key: row.row_key,
        causeCode: causeCodeOf(row),
        approvedLoss: {
          lines: impact.lines,
          values: impact.values.filter((v) => v.currency === currency),
        },
        ...portfolioFigures(row.rca_ids, facts, currency),
      });
    }
    return { items, view, basis };
  }

  /** Cases, actions and links of every case of the page, one query each. */
  private async facts(
    tenantId: string,
    rcaIds: readonly string[],
  ): Promise<PageFacts> {
    const ids = [...new Set(rcaIds)];
    if (ids.length === 0) return { cases: new Map(), actions: [], links: [] };
    const params = [tenantId, ids];
    const [cases, actions, links] = await Promise.all([
      this.dataSource.query<
        Array<{
          id: string;
          title: string;
          status: string | null;
          created_at: Date;
        }>
      >(PORTFOLIO_CASES_SQL, params),
      this.dataSource.query<ActionRecord[]>(PORTFOLIO_ACTIONS_SQL, params),
      this.dataSource.query<LinkRecord[]>(PORTFOLIO_LINKS_SQL, params),
    ]);
    return {
      cases: new Map(
        cases.map((c) => [
          c.id,
          {
            id: c.id,
            title: c.title,
            status: c.status,
            createdAt: new Date(c.created_at).toISOString(),
          },
        ]),
      ),
      actions: actions.map(toActionFact),
      links,
    };
  }
}
