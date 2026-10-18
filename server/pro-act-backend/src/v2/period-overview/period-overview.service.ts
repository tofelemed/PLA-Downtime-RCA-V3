import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository, SelectQueryBuilder } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { applyOverlapWindow } from '../../common/query/overlap-window';
import { scopedQuery } from '../../common/query/scoped-query';
import { ReconciliationSlaService } from '../../close/reconciliation-sla.service';
import { AccountingPoliciesService } from '../../periods/accounting-policies.service';
import { PeriodProductSlice } from '../../periods/entities/period-product-slice.entity';
import { ProductionPeriod } from '../../periods/entities/production-period.entity';
import {
  assertBodyUnitsInScope,
  periodScopeUnits,
} from '../../periods/period-scope';
import { invalid, invalidReference } from '../../profiles/profile-errors';
import { ListResponse, listResponse, ListScope } from '../common/response';
import {
  PeriodSummaryQueryDto,
  WaterfallQueryDto,
} from './period-overview.dto';
import {
  loadPeriodStates,
  PeriodState,
  RevisionSelector,
} from './period-states';
import {
  PeriodSummaryV2View,
  toPeriodSummaryView,
} from './period-summary.view';
import { WaterfallV2View, waterfallOf } from './waterfall.view';
import { summaryPage } from './period-summary-page';
import { planIdOf, planIdsOfVersions } from '../periods/period-plan-ids';
import { toPeriodSlaView } from '../close/period-sla.view';

/** Shown revision's workflow state in SQL (the same rule as `pickRevision` / `workflowOf`). */
function workflowStateSql(selector: RevisionSelector): string {
  const filter =
    selector === 'approved'
      ? `r."lifecycle" = 'approved'`
      : `r."lifecycle" <> 'cancelled'`;
  return `COALESCE((SELECT CASE WHEN r."lifecycle" = 'in_review' AND r."is_stale" THEN 'stale' ELSE r."lifecycle"::text END
      FROM "accounting_revisions" r WHERE r."period_id" = p."id" AND ${filter}
      ORDER BY r."revision" DESC LIMIT 1), 'none')`;
}

/**
 * Reads of the Plan Dashboard (plan 3.5): the period grid — per period the plan-ledger figures of the
 * shown revision after its saved decisions, its workflow state, run and actuals quality — and the ledger
 * waterfall of 1–31 periods. Reads never write; every number is computed here, never in the browser.
 */
@Injectable()
export class PeriodOverviewService {
  constructor(
    @InjectRepository(ProductionPeriod)
    private readonly periods: Repository<ProductionPeriod>,
    private readonly policies: AccountingPoliciesService,
    private readonly slas: ReconciliationSlaService,
  ) {}

  async summaries(
    context: RequestContext,
    query: PeriodSummaryQueryDto,
  ): Promise<ListResponse<PeriodSummaryV2View>> {
    if (query.from && query.to && new Date(query.from) >= new Date(query.to)) {
      throw invalid('INVALID_RANGE', 'from must be before to');
    }
    if (query.unitIds?.length) await this.assertUnits(context, query.unitIds);
    const selector = query.view ?? 'current';
    const manager = this.periods.manager;
    const page = await summaryPage({
      build: () => {
        const qb = scopedQuery(this.periods, 'p', {
          context,
          unitProperty: 'unitId',
        });
        applyFilters(qb, query, selector);
        return qb;
      },
      direction: query.sort === '-utcStart' ? 'DESC' : 'ASC',
      cursor: query.cursor,
      limit: query.limit,
      load: (periods) =>
        loadPeriodStates(manager, periods, selector, this.policies),
      residualStates: query.residualStates,
    });
    const items = await this.summaryViews(context, page.states);
    return listResponse(items, page.nextCursor, this.scope(context));
  }

  /** Grid rows of a page: active products, SLA and plan of each period (one query each, no N+1). */
  private async summaryViews(
    context: RequestContext,
    states: readonly PeriodState[],
  ): Promise<PeriodSummaryV2View[]> {
    const manager = this.periods.manager;
    const periods = states.map((state) => state.period);
    const [slices, slas, plans] = await Promise.all([
      this.activeSlices(periods.map((p) => p.id)),
      this.slas.statuses(manager, periods, new Date()),
      planIdsOfVersions(manager, requireTenantId(context), periods),
    ]);
    const items = states.map((state) => {
      const sla = slas.get(state.period.id);
      return toPeriodSummaryView(
        state,
        slices.get(state.period.id) ?? [],
        sla ? toPeriodSlaView(sla) : null,
        planIdOf(state.period, plans),
      );
    });
    return items;
  }

  async waterfall(
    context: RequestContext,
    query: WaterfallQueryDto,
  ): Promise<WaterfallV2View> {
    const ids = [...new Set(query.periodIds)];
    const found = await scopedQuery(this.periods, 'p', {
      context,
      unitProperty: 'unitId',
    })
      .andWhere('p.id IN (:...ids)', { ids })
      .orderBy('p.utcStart', 'ASC')
      .getMany();
    if (found.length !== ids.length)
      throw invalidReference('periodIds', 'production period');
    const selector = query.view ?? 'current';
    const states = await loadPeriodStates(
      this.periods.manager,
      found,
      selector,
      this.policies,
    );
    return waterfallOf(states, query.ledger ?? 'plan', selector);
  }

  private async activeSlices(
    periodIds: string[],
  ): Promise<Map<string, string[]>> {
    const rows = periodIds.length
      ? await this.periods.manager.find(PeriodProductSlice, {
          where: { periodId: In(periodIds), supersededAt: IsNull() },
          select: { id: true, periodId: true, productId: true },
          order: { windowFrom: 'ASC' },
        })
      : [];
    const map = new Map<string, string[]>();
    for (const row of rows) {
      const list = map.get(row.periodId) ?? [];
      if (!list.includes(row.productId)) list.push(row.productId);
      map.set(row.periodId, list);
    }
    return map;
  }

  /** Named units must be units of the tenant and of the caller's scope (422 INVALID_REFERENCE). */
  private async assertUnits(
    context: RequestContext,
    unitIds: string[],
  ): Promise<void> {
    assertBodyUnitsInScope(context, unitIds);
    const named = [...new Set(unitIds)];
    const rows: Array<{ id: string }> = await this.periods.manager.query(
      `SELECT "id" FROM "units" WHERE "tenant_id" = $1 AND "id" = ANY($2::uuid[])`,
      [requireTenantId(context), named],
    );
    if (rows.length !== named.length) throw invalidReference('unitIds', 'unit');
  }

  private scope(context: RequestContext): ListScope {
    const units = periodScopeUnits(context);
    return {
      tenantId: requireTenantId(context),
      ...(units ? { unitIds: units } : {}),
    };
  }
}

function applyFilters(
  qb: SelectQueryBuilder<ProductionPeriod>,
  query: PeriodSummaryQueryDto,
  selector: RevisionSelector,
): void {
  applyOverlapWindow(
    qb,
    { alias: 'p', start: 'utcStart', end: 'utcEnd' },
    query.from,
    query.to,
  );
  if (query.unitIds?.length)
    qb.andWhere('p.unitId IN (:...unitIds)', { unitIds: query.unitIds });
  if (query.workflowState?.length) {
    qb.andWhere(`${workflowStateSql(selector)} IN (:...workflowStates)`, {
      workflowStates: query.workflowState,
    });
  }
  // every residual state but not_computable needs a calculated revision: skip periods without one in SQL
  const residual = query.residualStates;
  if (residual?.length && !residual.includes('not_computable')) {
    qb.andWhere(`${workflowStateSql(selector)} <> 'none'`);
  }
}
