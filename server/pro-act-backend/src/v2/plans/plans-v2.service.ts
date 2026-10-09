import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { applyOverlapWindow } from '../../common/query/overlap-window';
import { scopedQuery } from '../../common/query/scoped-query';
import { Distribution } from '../../domain/plans/plan.types';
import { ProductionPlan } from '../../production-plan/production-plan.entity';
import { PlanPeriod } from '../../plans/entities/plan-period.entity';
import { PlanScenario } from '../../plans/entities/plan-scenario.entity';
import { PlanVersion } from '../../plans/entities/plan-version.entity';
import { invalid } from '../../plans/plan-errors';
import { PlanPeriodGeneratorService } from '../../plans/plan-period-generator.service';
import { scopeUnitIds } from '../../plans/plan-scope';
import { PlanVersionsService } from '../../plans/plan-versions.service';
import { keysetPage } from '../common/keyset-page';
import { listResponse, ListResponse, ListScope } from '../common/response';
import {
  PlanListQueryDto,
  PlanPeriodListQueryDto,
  PlanVersionListQueryDto,
  ScenarioListQueryDto,
} from './plan-v2.dto';
import {
  decimalView,
  PlanPeriodV2View,
  PlanPreviewV2View,
  PlanScenarioV2View,
  PlanV2View,
  PlanVersionV2View,
  toPlanView,
  toPreviewView,
  toScenarioView,
  toVersionView,
} from './plan-v2.view';

/** v2 reads of plan 2.3: tenant- and unit-scoped through the plan version, keyset pages; previews. */
@Injectable()
export class PlansV2Service {
  constructor(
    @InjectRepository(PlanVersion)
    private readonly versions: Repository<PlanVersion>,
    private readonly plans: PlanVersionsService,
    private readonly generator: PlanPeriodGeneratorService,
  ) {}

  /** Plans with their current version (keyset on the version's createdAt, id). */
  async listPlans(
    context: RequestContext,
    query: PlanListQueryDto,
  ): Promise<ListResponse<PlanV2View>> {
    const qb = scopedQuery(this.versions, 'v', {
      context,
      unitProperty: 'unitId',
    }).innerJoin(
      ProductionPlan,
      'p',
      'p.id = v.planId AND p.currentVersion = v.version',
    );
    applyPlanFilters(qb, query);
    const page = await keysetPage(qb, {
      alias: 'v',
      property: 'createdAt',
      direction: 'ASC',
      cursor: query.cursor,
      limit: query.limit,
    });
    const headers = page.items.length
      ? await this.versions.manager.findBy(ProductionPlan, {
          id: In(page.items.map((v) => v.planId)),
        })
      : [];
    const byId = new Map(headers.map((plan) => [plan.id, plan]));
    const items = page.items.flatMap((version) => {
      const plan = byId.get(version.planId);
      return plan ? [toPlanView(plan, version)] : [];
    });
    return listResponse(items, page.nextCursor, scopeOf(context));
  }

  /**
   * Version history of a visible plan, newest first (plan 3.4): states, supersession and approval of
   * every version, without slices (one query per page). Versions outside the caller's units are hidden.
   */
  async listVersions(
    context: RequestContext,
    planId: string,
    query: PlanVersionListQueryDto,
  ): Promise<ListResponse<PlanVersionV2View>> {
    await this.plans.getPlan(context, planId);
    const qb = scopedQuery(this.versions, 'v', {
      context,
      unitProperty: 'unitId',
    }).andWhere('v.planId = :planId', { planId });
    const page = await keysetPage(qb, {
      alias: 'v',
      property: 'createdAt',
      direction: 'DESC',
      cursor: query.cursor,
      limit: query.limit,
    });
    return listResponse(
      page.items.map((version) => toVersionView(version)),
      page.nextCursor,
      scopeOf(context),
    );
  }

  /** Stored periods of one version (keyset on utcStart, id; `from`/`to` overlap window). */
  async listPeriods(
    context: RequestContext,
    target: { planId: string; version: number },
    query: PlanPeriodListQueryDto,
  ): Promise<ListResponse<PlanPeriodV2View>> {
    const version = await this.plans.getVersion(
      context,
      target.planId,
      target.version,
    );
    if (query.from && query.to && new Date(query.from) >= new Date(query.to)) {
      throw invalid('INVALID_RANGE', 'from must be before to');
    }
    const periods = this.versions.manager.getRepository(PlanPeriod);
    const qb = scopedQuery(periods, 'pp', {
      context,
      unitProperty: 'unitId',
    }).andWhere('pp.planVersionId = :versionId', { versionId: version.id });
    applyOverlapWindow(
      qb,
      { alias: 'pp', start: 'utcStart', end: 'utcEnd' },
      query.from,
      query.to,
    );
    const page = await keysetPage(qb, {
      alias: 'pp',
      property: 'utcStart',
      direction: 'ASC',
      cursor: query.cursor,
      limit: query.limit,
    });
    return listResponse(page.items.map(toPeriodView), page.nextCursor, {
      ...scopeOf(context),
      unitIds: [version.unitId],
    });
  }

  /** PLAN03 preview: the periods a generation would store, with warnings; nothing is written. */
  async preview(
    context: RequestContext,
    planId: string,
    body: { version: number; distribution?: Distribution },
  ): Promise<PlanPreviewV2View> {
    const version = await this.plans.getVersion(context, planId, body.version);
    const slices = await this.plans.slicesOf(version.id);
    const distribution = body.distribution ?? version.distribution;
    const result = await this.generator.compute(version, slices, distribution);
    return toPreviewView(version, distribution, result);
  }

  async listScenarios(
    context: RequestContext,
    query: ScenarioListQueryDto,
  ): Promise<ListResponse<PlanScenarioV2View>> {
    const scenarios = this.versions.manager.getRepository(PlanScenario);
    const page = await keysetPage(scopedQuery(scenarios, 's', { context }), {
      alias: 's',
      property: 'createdAt',
      direction: 'ASC',
      cursor: query.cursor,
      limit: query.limit,
    });
    return listResponse(
      page.items.map(toScenarioView),
      page.nextCursor,
      scopeOf(context),
    );
  }
}

function applyPlanFilters(
  qb: SelectQueryBuilder<PlanVersion>,
  query: PlanListQueryDto,
): void {
  if (query.unitId) qb.andWhere('v.unitId = :unitId', { unitId: query.unitId });
  if (query.scenarioId) {
    qb.andWhere('v.scenarioId = :scenarioId', {
      scenarioId: query.scenarioId,
    });
  }
  if (query.approvalState) {
    qb.andWhere('v.approvalState = :state', { state: query.approvalState });
  }
}

function scopeOf(context: RequestContext): ListScope {
  const unitIds = scopeUnitIds(context);
  return {
    tenantId: requireTenantId(context),
    ...(unitIds ? { unitIds } : {}),
  };
}

function toPeriodView(period: PlanPeriod): PlanPeriodV2View {
  return {
    id: period.id,
    sliceId: period.sliceId,
    unitId: period.unitId,
    shiftInstanceId: period.shiftInstanceId,
    calendarVersionId: period.calendarVersionId,
    utcStart: period.utcStart.toISOString(),
    utcEnd: period.utcEnd.toISOString(),
    localDate: period.localDate,
    shiftName: period.shiftName,
    scheduledSeconds: period.scheduledSeconds,
    target: decimalView(period.target) ?? '0',
    planningCapacityQty: decimalView(period.planningCapacityQty),
    sustainedCapacityQty: decimalView(period.sustainedCapacityQty),
    quantityUom: period.quantityUom,
    profileId: period.profileId,
    planningRateVersionId: period.planningRateVersionId,
    sustainedRateVersionId: period.sustainedRateVersionId,
    isExcluded: period.isExcluded,
    exclusionKind: period.exclusionKind,
  };
}
