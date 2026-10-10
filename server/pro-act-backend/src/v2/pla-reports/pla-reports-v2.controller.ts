import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { AnalyticsResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { WaterfallV2View } from '../period-overview/waterfall.view';
import { ReportWindowQueryDto } from '../reports/kpi-reports-v2.dto';
import { ActualsQualityView } from './actuals-quality';
import { LossTreeView } from './loss-tree-report';
import {
  LossTreeQueryDto,
  ReconciliationStatusQueryDto,
  ReconciliationTrendQueryDto,
  ScopeWaterfallQueryDto,
} from './pla-reports.dto';
import { PlaReportsV2Service } from './pla-reports-v2.service';
import { ReconciliationStatusView } from './reconciliation-status';
import { ReconciliationTrendView } from './reconciliation-trend';

const SCOPE_NOTE =
  'Read-only, never computes on read from anything but the stored runs, ledgers, decisions and actuals. Periods ' +
  'starting in [from, to) (≤ 400 days, ≤ 1500 periods: 422 TOO_MANY_PERIODS); unitIds must be units of the ' +
  'tenant and the caller’s scope (422 INVALID_REFERENCE), omitted: every unit the caller may read. Shows the ' +
  'approved revision, else the open draft (provisional); approvedOnly = approved revisions only.';

/** PLA analytics of plan 3.6 (AN02, AN03): window waterfall, loss tree, reconciliation trend / status, actuals quality. */
@ApiTags('v2 · PLA analytics')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'reports', version: '2' })
export class PlaReportsV2Controller {
  constructor(private readonly reports: PlaReportsV2Service) {}

  @Get('scope-waterfall')
  @ApiOperation({
    summary:
      'Ledger waterfall of every period of a window and units: opening, signed steps with start / end, closing actual',
    description: `${SCOPE_NOTE} Same bars and closure check as GET /reports/waterfall (plan 3.5); different units of measure 422 UOM_MIXED.`,
  })
  scopeWaterfall(
    @Ctx() ctx: RequestContext,
    @Query() query: ScopeWaterfallQueryDto,
  ): Promise<AnalyticsResponse<WaterfallV2View>> {
    return this.reports.scopeWaterfall(ctx, query);
  }

  @Get('loss-tree')
  @ApiOperation({
    summary:
      'Loss lines per reason, impact, OEE component, kind or unit: quantity per unit of measure or one valuation view per currency, largest first with cumulative share',
    description: `${SCOPE_NOTE} Calculation-run loss lines (decisions of an open draft are in the waterfall); unvalued lines never count as 0.`,
  })
  lossTree(
    @Ctx() ctx: RequestContext,
    @Query() query: LossTreeQueryDto,
  ): Promise<AnalyticsResponse<LossTreeView>> {
    return this.reports.lossTree(ctx, query);
  }

  @Get('reconciliation-trend')
  @ApiOperation({
    summary:
      'Unaccounted, over-accounted and overproduction quantity per site-local shift, day, week or month (plan ledger, after decisions)',
    description: SCOPE_NOTE,
  })
  reconciliationTrend(
    @Ctx() ctx: RequestContext,
    @Query() query: ReconciliationTrendQueryDto,
  ): Promise<AnalyticsResponse<ReconciliationTrendView>> {
    return this.reports.reconciliationTrend(ctx, query);
  }

  @Get('reconciliation-status')
  @ApiOperation({
    summary:
      'Workflow and residual state of every period, age of the periods not approved, and the overdue periods',
    description: `${SCOPE_NOTE} Workflow uses each period's current revision (open, else published) like the Plan Dashboard grid; approvedOnly does not apply.`,
  })
  reconciliationStatus(
    @Ctx() ctx: RequestContext,
    @Query() query: ReconciliationStatusQueryDto,
  ): Promise<AnalyticsResponse<ReconciliationStatusView>> {
    return this.reports.reconciliationStatus(ctx, query);
  }

  @Get('actuals-quality')
  @ApiOperation({
    summary:
      'Actuals quality coverage: quality state and coverage band per product slice, lowest coverage, measured vs estimated output',
    description: SCOPE_NOTE,
  })
  actualsQuality(
    @Ctx() ctx: RequestContext,
    @Query() query: ReportWindowQueryDto,
  ): Promise<AnalyticsResponse<ActualsQualityView>> {
    return this.reports.actualsQuality(ctx, query);
  }
}
