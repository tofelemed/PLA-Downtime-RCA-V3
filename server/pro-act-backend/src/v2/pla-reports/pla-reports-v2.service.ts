import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestContext } from '../../common/context/request-context';
import { AccountingPoliciesService } from '../../periods/accounting-policies.service';
import { ProductionPeriod } from '../../periods/entities/production-period.entity';
import { AnalyticsResponse } from '../common/response';
import {
  PeriodState,
  RevisionSelector,
} from '../period-overview/period-states';
import {
  WaterfallV2View,
  waterfallOf,
} from '../period-overview/waterfall.view';
import { reportEnvelope } from '../reports/kpi-reports-v2.view';
import { ReportScope, resolveReportScope } from '../reports/report-scope';
import { periodStats, policyVersions } from '../reports/report-sql';
import { ReportWindowQueryDto } from '../reports/kpi-reports-v2.dto';
import { actualsQuality, ActualsQualityView } from './actuals-quality';
import { lossTreeCells, LossTreeView } from './loss-tree-report';
import { lossTreeView } from './loss-tree-view';
import {
  LossTreeQueryDto,
  ReconciliationStatusQueryDto,
  ReconciliationTrendQueryDto,
  ScopeWaterfallQueryDto,
} from './pla-reports.dto';
import {
  reconciliationStatus,
  ReconciliationStatusView,
} from './reconciliation-status';
import {
  reconciliationTrend,
  ReconciliationTrendView,
} from './reconciliation-trend';
import { scopeStates, shownSelector } from './scope-periods';

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
  ) {}

  async scopeWaterfall(
    context: RequestContext,
    query: ScopeWaterfallQueryDto,
  ): Promise<AnalyticsResponse<WaterfallV2View>> {
    const { scope, states } = await this.load(context, query, null);
    const data = waterfallOf(
      states,
      query.ledger ?? 'plan',
      shownSelector(scope),
    );
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
    const { scope, states } = await this.load(context, query, null);
    const data = reconciliationTrend(states, query.groupBy ?? 'day');
    return this.envelope(scope, data, provisional(states));
  }

  async reconciliationStatus(
    context: RequestContext,
    query: ReconciliationStatusQueryDto,
  ): Promise<AnalyticsResponse<ReconciliationStatusView>> {
    const { scope, states } = await this.load(context, query, 'current');
    const versionIds = states.flatMap((s) =>
      s.period.selectedPlanVersionId ? [s.period.selectedPlanVersionId] : [],
    );
    const [unitNames, plans] = await Promise.all([
      this.idMap(
        `SELECT "id"::text AS "id", "name" AS "value" FROM "units" WHERE "tenant_id" = $1 AND "id" = ANY($2::uuid[])`,
        scope,
        scope.unitIds,
      ),
      this.idMap(
        `SELECT "id"::text AS "id", "plan_id"::text AS "value" FROM "plan_versions" WHERE "tenant_id" = $1 AND "id" = ANY($2::uuid[])`,
        scope,
        versionIds,
      ),
    ]);
    const data = reconciliationStatus(states, {
      asOf: query.asOf ? new Date(query.asOf) : new Date(),
      overdueAfterHours: query.overdueAfterHours ?? 48,
      unitNames,
      plans,
    });
    return this.envelope(scope, data, provisional(states));
  }

  async actualsQuality(
    context: RequestContext,
    query: ReportWindowQueryDto,
  ): Promise<AnalyticsResponse<ActualsQualityView>> {
    const { scope, states } = await this.load(context, query, null);
    return this.envelope(scope, actualsQuality(states), provisional(states));
  }

  /** Scope and period states; `selector` null = the shown revision of the scope (approvedOnly aware). */
  private async load(
    context: RequestContext,
    query: ReportWindowQueryDto,
    selector: RevisionSelector | null,
  ): Promise<{ scope: ReportScope; states: PeriodState[] }> {
    const scope = await resolveReportScope(
      this.periods.manager,
      context,
      query,
    );
    const states = await scopeStates(this.periods, {
      context,
      scope,
      selector: selector ?? shownSelector(scope),
      policies: this.policies,
    });
    return { scope, states };
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

  private async idMap(
    sql: string,
    scope: ReportScope,
    ids: string[],
  ): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const rows = await this.periods.manager.query<
      Array<{ id: string; value: string }>
    >(sql, [scope.tenantId, [...new Set(ids)]]);
    return new Map(rows.map((r) => [r.id, r.value]));
  }
}

const provisional = (states: readonly PeriodState[]) =>
  states.some(
    (s) => s.revision !== null && s.revision.lifecycle !== 'approved',
  );
