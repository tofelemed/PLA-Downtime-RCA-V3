import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { scopedQuery } from '../../common/query/scoped-query';
import { AccountingPoliciesService } from '../../periods/accounting-policies.service';
import { ProductionPeriod } from '../../periods/entities/production-period.entity';
import { AnalyticsResponse } from '../common/response';
import { loadPeriodStates } from '../period-overview/period-states';
import { foldScopeStates, shownSelector } from '../pla-reports/scope-periods';
import { planIdsOfVersions } from '../periods/period-plan-ids';
import { reportEnvelope } from '../reports/kpi-reports-v2.view';
import { ReportScope, resolveReportScope } from '../reports/report-scope';
import { periodStats, policyVersions } from '../reports/report-sql';
import { LossStatementView } from './loss-statement';
import { LossStatementQueryDto } from './loss-statement.dto';
import {
  LossStatementRowView,
  rowCursor,
  statementRow,
  statementRowPage,
  unitNames,
} from './statement-rows';
import { statementsOfStates } from './statement-sources';
import {
  addStatement,
  StatementSum,
  statementSum,
  sumView,
} from './statement-sum';

/** `GET /v2/reports/loss-statement`: the window's statement, the keyset page of its periods. */
export interface LossStatementReportView {
  /**
   * the statement of every complete period of the window; null when none is complete, units differ, or on
   * a later page (`cursor` given: the total is computed on page one only)
   */
  total: LossStatementView | null;
  /**
   * periods left out of `total` (no approved revision when approved only, no run, target or actuals);
   * null on a later page
   */
  incomplete: number | null;
  items: LossStatementRowView[];
  nextCursor: string | null;
}

/** The statement of a production day (its periods' shown revisions summed); `incomplete` = periods left out. */
export interface DayStatementView {
  statement: LossStatementView | null;
  incomplete: number;
}

const NOTE_INCOMPLETE = 'incomplete_periods';
const NOTE_UOM_MIXED = 'uom_mixed';

function totalNotes(sum: StatementSum): string[] {
  return [
    ...(sum.incomplete > 0 ? [NOTE_INCOMPLETE] : []),
    ...(sum.uoms.size > 1 ? [NOTE_UOM_MIXED] : []),
  ];
}

/**
 * The loss accounting statement (Task 13, owner requirement 27 Oct 2026) of a window, a day and the rows
 * of a window: server-side sums of the shown revisions' reconciled plan ledgers (approved revision when
 * approved only, else the approved one or the open draft, marked provisional). Read-only.
 */
@Injectable()
export class LossStatementV2Service {
  constructor(
    @InjectRepository(ProductionPeriod)
    private readonly periods: Repository<ProductionPeriod>,
    private readonly policies: AccountingPoliciesService,
  ) {}

  async report(
    context: RequestContext,
    query: LossStatementQueryDto,
  ): Promise<AnalyticsResponse<LossStatementReportView>> {
    const manager = this.periods.manager;
    const scope = await resolveReportScope(manager, context, {
      from: query.from,
      to: query.to,
      unitIds: query.unitIds,
      approvedOnly: query.revision === 'approved',
    });
    const page = await this.rows(context, scope, query);
    const total = query.cursor ? null : await this.total(context, scope);
    const data = {
      total: total ? sumView(total.sum) : null,
      incomplete: total ? total.sum.incomplete : null,
      ...page,
    };
    const stats = await periodStats(manager, scope);
    const pageProvisional = page.items.some(
      (row) => row.revisionState === 'provisional',
    );
    return reportEnvelope(data, {
      scope,
      stats,
      policyVersions: await policyVersions(manager, stats.runIds),
      provisionalData: total ? total.provisional : pageProvisional,
      notes: total ? totalNotes(total.sum) : [],
    });
  }

  /** Page one only: the window's total (every period folded) and whether any of it is provisional. */
  private async total(
    context: RequestContext,
    scope: ReportScope,
  ): Promise<{ sum: StatementSum; provisional: boolean }> {
    const sum = statementSum();
    const provisional = await this.foldTotal(context, scope, sum);
    return { sum, provisional: provisional || sum.provisional };
  }

  /** The day's statement: its periods (shown revision: approved, else the open draft) summed. */
  async day(
    context: RequestContext,
    unitId: string,
    localDate: string,
  ): Promise<DayStatementView> {
    const periods = await scopedQuery(this.periods, 'p', {
      context,
      unitProperty: 'unitId',
    })
      .andWhere('p.unitId = :unitId AND p.localDate = :localDate', {
        unitId,
        localDate,
      })
      .orderBy('p.utcStart', 'ASC')
      .getMany();
    const states = await loadPeriodStates(
      this.periods.manager,
      periods,
      'shown',
      this.policies,
      { actuals: false },
    );
    const sum = statementSum();
    const tenantId = requireTenantId(context);
    for (const statement of await statementsOfStates(
      this.periods.manager,
      tenantId,
      states,
    )) {
      addStatement(sum, statement);
    }
    return { statement: sumView(sum), incomplete: sum.incomplete };
  }

  private foldTotal(
    context: RequestContext,
    scope: ReportScope,
    sum: StatementSum,
  ): Promise<boolean> {
    const input = {
      context,
      scope,
      selector: shownSelector(scope),
      policies: this.policies,
      actuals: false,
    };
    return foldScopeStates(this.periods, input, async (states) => {
      const statements = await statementsOfStates(
        this.periods.manager,
        scope.tenantId,
        states,
      );
      for (const statement of statements) addStatement(sum, statement);
    });
  }

  private async rows(
    context: RequestContext,
    scope: ReportScope,
    query: LossStatementQueryDto,
  ): Promise<Pick<LossStatementReportView, 'items' | 'nextCursor'>> {
    if (scope.unitIds.length === 0) return { items: [], nextCursor: null };
    const manager = this.periods.manager;
    const found = await statementRowPage(this.periods, {
      context,
      scope,
      cursor: query.cursor,
      limit: query.limit,
    });
    const page = found.slice(0, query.limit);
    const states = await loadPeriodStates(
      manager,
      page,
      shownSelector(scope),
      this.policies,
      { actuals: false },
    );
    const [statements, plans, units] = await Promise.all([
      statementsOfStates(manager, scope.tenantId, states),
      planIdsOfVersions(manager, scope.tenantId, page),
      unitNames(
        manager,
        scope.tenantId,
        page.map((p) => p.unitId),
      ),
    ]);
    return {
      items: states.map((state, i) =>
        statementRow(state, statements[i], { plans, units }),
      ),
      nextCursor:
        found.length > query.limit ? rowCursor(page[page.length - 1]) : null,
    };
  }
}
