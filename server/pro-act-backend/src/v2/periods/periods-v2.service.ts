import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository, SelectQueryBuilder } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { applyOverlapWindow } from '../../common/query/overlap-window';
import { scopedQuery } from '../../common/query/scoped-query';
import { Dec } from '../../domain/actuals/decimal';
import { ActualsAdjustment } from '../../periods/entities/actuals-adjustment.entity';
import { ActualsResult } from '../../periods/entities/actuals-result.entity';
import { ActualsRun } from '../../periods/entities/actuals-run.entity';
import { PeriodProductSlice } from '../../periods/entities/period-product-slice.entity';
import { ProductionPeriod } from '../../periods/entities/production-period.entity';
import { periodScopeUnits } from '../../periods/period-scope';
import { invalid, notFound } from '../../profiles/profile-errors';
import { keysetPage } from '../common/keyset-page';
import {
  AnalyticsResponse,
  listResponse,
  ListResponse,
  ListScope,
} from '../common/response';
import { PeriodListQueryDto } from './period-v2.dto';
import {
  PeriodDetailV2View,
  PeriodV2View,
  toAdjustmentView,
  toDetail,
  toPeriodBase,
  toSliceView,
  toSummary,
} from './period-v2.view';

/**
 * v2 reads of plan 2.4: the period grid (tenant- and unit-scoped, keyset on utcStart, overlap window,
 * unit / product / readiness filters) with the authoritative summary of every active slice, and one
 * period with slices, full actuals provenance and adjustments as an analytical response.
 */
@Injectable()
export class PeriodsV2Service {
  constructor(
    @InjectRepository(ProductionPeriod)
    private readonly periods: Repository<ProductionPeriod>,
  ) {}

  async list(
    context: RequestContext,
    query: PeriodListQueryDto,
  ): Promise<ListResponse<PeriodV2View>> {
    if (query.from && query.to && new Date(query.from) >= new Date(query.to)) {
      throw invalid('INVALID_RANGE', 'from must be before to');
    }
    const qb = scopedQuery(this.periods, 'p', {
      context,
      unitProperty: 'unitId',
    });
    applyFilters(qb, query);
    const page = await keysetPage(qb, {
      alias: 'p',
      property: 'utcStart',
      direction: 'ASC',
      cursor: query.cursor,
      limit: query.limit,
    });
    const { slices, results } = await this.slicesAndResults(page.items);
    const items = page.items.map((period) =>
      summaryOf(period, slices, results),
    );
    return listResponse(items, page.nextCursor, scopeOf(context));
  }

  async get(
    context: RequestContext,
    id: string,
  ): Promise<AnalyticsResponse<PeriodDetailV2View>> {
    const period = await scopedQuery(this.periods, 'p', {
      context,
      unitProperty: 'unitId',
    })
      .andWhere('p.id = :id', { id })
      .getOne();
    if (!period) throw notFound('Production period');
    const { slices, results } = await this.slicesAndResults([period]);
    const adjustments = await this.periods.manager.find(ActualsAdjustment, {
      where: { periodId: period.id },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    const run = period.currentActualsRunId
      ? await this.periods.manager.findOneBy(ActualsRun, {
          id: period.currentActualsRunId,
        })
      : null;
    const data: PeriodDetailV2View = {
      ...toPeriodBase(period),
      slices: slices.map((slice) => {
        const result = results.find((r) => r.sliceId === slice.id);
        return toSliceView(slice, result ? toDetail(result) : null);
      }),
      adjustments: adjustments.map(toAdjustmentView),
    };
    return analytics(period, data, {
      run,
      results,
      scope: { ...scopeOf(context), unitIds: [period.unitId] },
    });
  }

  private async slicesAndResults(periods: readonly ProductionPeriod[]) {
    if (periods.length === 0) return { slices: [], results: [] };
    const slices = await this.periods.manager.find(PeriodProductSlice, {
      where: { periodId: In(periods.map((p) => p.id)), supersededAt: IsNull() },
      order: { windowFrom: 'ASC', productId: 'ASC' },
    });
    const runIds = periods.flatMap((p) =>
      p.currentActualsRunId ? [p.currentActualsRunId] : [],
    );
    const results = runIds.length
      ? await this.periods.manager.find(ActualsResult, {
          where: { actualsRunId: In(runIds) },
        })
      : [];
    return { slices, results };
  }
}

/** Overlap window, units, readiness and products (active slice) of the grid query. */
function applyFilters(
  qb: SelectQueryBuilder<ProductionPeriod>,
  query: PeriodListQueryDto,
): void {
  applyOverlapWindow(
    qb,
    { alias: 'p', start: 'utcStart', end: 'utcEnd' },
    query.from,
    query.to,
  );
  if (query.unitIds?.length)
    qb.andWhere('p.unitId IN (:...unitIds)', { unitIds: query.unitIds });
  if (query.readiness?.length) {
    qb.andWhere('p.stateReadiness IN (:...readiness)', {
      readiness: query.readiness,
    });
  }
  if (query.productIds?.length) {
    qb.andWhere(
      `EXISTS (SELECT 1 FROM "period_product_slices" s WHERE s."period_id" = p.id AND s."superseded_at" IS NULL AND s."product_id" IN (:...productIds))`,
      { productIds: query.productIds },
    );
  }
}

/** A grid row: the period and each active slice with the result of the current run. */
function summaryOf(
  period: ProductionPeriod,
  slices: readonly PeriodProductSlice[],
  results: readonly ActualsResult[],
): PeriodV2View {
  return {
    ...toPeriodBase(period),
    slices: slices
      .filter((slice) => slice.periodId === period.id)
      .map((slice) => {
        const result = results.find(
          (r) =>
            r.sliceId === slice.id &&
            r.actualsRunId === period.currentActualsRunId,
        );
        return toSliceView(slice, result ? toSummary(result) : null);
      }),
  };
}

function analytics(
  period: ProductionPeriod,
  data: PeriodDetailV2View,
  context: {
    run: ActualsRun | null;
    results: ActualsResult[];
    scope: ListScope;
  },
): AnalyticsResponse<PeriodDetailV2View> {
  const ratios = context.results.map((r) =>
    r.coverageRatio === null ? 0 : new Dec(r.coverageRatio).toNumber(),
  );
  return {
    data,
    calculationRunId: context.run?.id ?? null,
    policyVersion: context.run
      ? context.run.policyVersions
          .map((p) => `${p.kind}@${p.version}`)
          .join(',')
      : null,
    dataQuality: {
      missingCount: context.results.filter((r) => r.qualityState === 'missing')
        .length,
      provisionalCount: context.results.filter(
        (r) => r.qualityState !== 'complete',
      ).length,
      notes: period.warnings.map((warning) => warning.code),
    },
    coverage: {
      from: period.utcStart.toISOString(),
      to: period.utcEnd.toISOString(),
      ratio: ratios.length ? Math.min(...ratios) : 0,
    },
    isProvisional: period.stateReadiness === 'open',
    asOf: new Date().toISOString(),
    scope: context.scope,
  };
}

function scopeOf(context: RequestContext): ListScope {
  const units = periodScopeUnits(context);
  return {
    tenantId: requireTenantId(context),
    ...(units ? { unitIds: units } : {}),
  };
}
