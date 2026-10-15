import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestContext } from '../../common/context/request-context';
import { ReconciliationSlaService } from '../../close/reconciliation-sla.service';
import { AccountingPoliciesService } from '../../periods/accounting-policies.service';
import { ProductionPeriod } from '../../periods/entities/production-period.entity';
import { AnalyticsResponse } from '../common/response';
import { PeriodState } from '../period-overview/period-states';
import {
  addWaterfallStates,
  finishWaterfall,
  waterfallAccumulator,
  WaterfallV2View,
} from '../period-overview/waterfall.view';
import { reportEnvelope } from '../reports/kpi-reports-v2.view';
import { ReportScope, resolveReportScope } from '../reports/report-scope';
import { periodStats, policyVersions } from '../reports/report-sql';
import { ReportWindowQueryDto } from '../reports/kpi-reports-v2.dto';
import {
  addQualityStates,
  ActualsQualityView,
  qualityAccumulator,
  qualityView,
} from './actuals-quality';
import { lossTreeCells, LossTreeView } from './loss-tree-report';
import { lossTreeView } from './loss-tree-view';
import {
  LossTreeQueryDto,
  ReconciliationStatusQueryDto,
  ReconciliationTrendQueryDto,
  ScopeWaterfallQueryDto,
} from './pla-reports.dto';
import {
  ReconciliationStatusView,
  StatusSummaryRow,
  statusView,
} from './reconciliation-status';
import {
  overduePeriods,
  residualCounts,
  statusSummary,
} from './reconciliation-status-report';
import {
  addTrendStates,
  ReconciliationTrendView,
  trendAccumulator,
  trendView,
} from './reconciliation-trend';
import { foldScopeStates, shownSelector } from './scope-periods';

/**
 * PLA analytics read models of plan 3.6 (AN02, AN03, API03): side-effect free reads over one report scope —
 * tenant and units from identity (`resolveReportScope`, 422 INVALID_REFERENCE), periods starting in the
 * window, the shown revision of each (approved, else the open draft; `approvedOnly` = approved only). Every
 * response carries the 2.7 envelope (runs, policy versions, coverage, provisional) of the same scope, so
 * the widgets of one page share their calculation runs (T24).
 */
@Injectable()
export class PlaReportsV2Service {
  constructor(
    @InjectRepository(ProductionPeriod)
    private readonly periods: Repository<ProductionPeriod>,
    private readonly policies: AccountingPoliciesService,
    private readonly slas: ReconciliationSlaService,
  ) {}

  async scopeWaterfall(
    context: RequestContext,
    query: ScopeWaterfallQueryDto,
  ): Promise<AnalyticsResponse<WaterfallV2View>> {
    const scope = await this.scope(context, query);
    const ledger = query.ledger ?? 'plan';
    const acc = waterfallAccumulator();
    await this.fold(context, scope, (states) =>
      addWaterfallStates(acc, states, ledger),
    );
    const data = finishWaterfall(acc, ledger, shownSelector(scope));
    return this.envelope(scope, data, data.isProvisional);
  }

  async lossTree(
    context: RequestContext,
    query: LossTreeQueryDto,
  ): Promise<AnalyticsResponse<LossTreeView>> {
    const manager = this.periods.manager;
    const scope = await resolveReportScope(manager, context, query);
    const request = {
      groupBy: query.groupBy ?? 'reason',
      metric: query.metric ?? 'qty',
      ledger: query.ledger ?? 'plan',
      kinds: query.kinds,
    };
    const [cells, stats] = await Promise.all([
      lossTreeCells(manager, scope, request),
      periodStats(manager, scope),
    ]);
    const data = lossTreeView(cells, {
      ...request,
      limit: query.limit,
      calculationRunIds: stats.runIds,
    });
    const unvalued = data.totals.some(
      (t) => t.status === 'unvalued' || t.status === 'mixed',
    );
    return this.envelope(
      scope,
      data,
      unvalued,
      data.totals.flatMap((t) => t.reasons),
    );
  }

  async reconciliationTrend(
    context: RequestContext,
    query: ReconciliationTrendQueryDto,
  ): Promise<AnalyticsResponse<ReconciliationTrendView>> {
    const scope = await this.scope(context, query);
    const groupBy = query.groupBy ?? 'day';
    const acc = trendAccumulator();
    const provisional = await this.fold(context, scope, (states) =>
      addTrendStates(acc, states, { groupBy, weekStart: scope.weekStart }),
    );
    return this.envelope(scope, trendView(acc, groupBy), provisional);
  }

  /** Counts by workflow state, age and overdue in SQL; residual counts paged; the 50 oldest overdue listed. */
  async reconciliationStatus(
    context: RequestContext,
    query: ReconciliationStatusQueryDto,
  ): Promise<AnalyticsResponse<ReconciliationStatusView>> {
    const scope = await this.scope(context, query);
    const asOf = query.asOf ? new Date(query.asOf) : new Date();
    const sla = await this.slas.policy(
      this.periods.manager,
      scope.tenantId,
      asOf,
    );
    const input = { context, scope, asOf, sla };
    const summary = await statusSummary(this.periods.manager, input);
    const [residual, overdue] = await Promise.all([
      summary.some((row) => row.runIds.length > 0)
        ? residualCounts(this.periods, input, this.policies)
        : new Map([['not_computable' as const, total(summary)]]),
      overduePeriods(this.periods, input, {
        policies: this.policies,
        slas: this.slas,
      }),
    ]);
    const data = statusView({ ...input, summary, residual, overdue });
    const open = summary.some(
      (row) => row.workflow !== 'none' && row.workflow !== 'approved',
    );
    return this.envelope(scope, data, open);
  }

  async actualsQuality(
    context: RequestContext,
    query: ReportWindowQueryDto,
  ): Promise<AnalyticsResponse<ActualsQualityView>> {
    const scope = await this.scope(context, query);
    const acc = qualityAccumulator();
    const provisional = await this.fold(context, scope, (states) =>
      addQualityStates(acc, states),
    );
    return this.envelope(scope, qualityView(acc), provisional);
  }

  private scope(
    context: RequestContext,
    query: ReportWindowQueryDto,
  ): Promise<ReportScope> {
    return resolveReportScope(this.periods.manager, context, query);
  }

  /** Pages of the scope's periods with the shown revision (approvedOnly aware); true when provisional. */
  private fold(
    context: RequestContext,
    scope: ReportScope,
    visit: (states: readonly PeriodState[]) => void,
  ): Promise<boolean> {
    return foldScopeStates(
      this.periods,
      {
        context,
        scope,
        selector: shownSelector(scope),
        policies: this.policies,
      },
      visit,
    );
  }

  private async envelope<T>(
    scope: ReportScope,
    data: T,
    provisionalData: boolean,
    notes: string[] = [],
  ): Promise<AnalyticsResponse<T>> {
    const manager = this.periods.manager;
    const stats = await periodStats(manager, scope);
    return reportEnvelope(data, {
      scope,
      stats,
      policyVersions: await policyVersions(manager, stats.runIds),
      provisionalData,
      notes: [...new Set(notes)].sort(),
    });
  }
}

const total = (rows: readonly StatusSummaryRow[]) =>
  rows.reduce((n, row) => n + row.periods, 0);
