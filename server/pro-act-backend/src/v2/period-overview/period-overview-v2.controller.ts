import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import {
  PeriodSummaryQueryDto,
  WaterfallQueryDto,
} from './period-overview.dto';
import { PeriodOverviewService } from './period-overview.service';
import { PeriodSummaryV2View } from './period-summary.view';
import { WaterfallV2View } from './waterfall.view';

/** The Plan Dashboard period grid (plan 3.5, §16.2): one row per period with its plan-ledger figures. */
@ApiTags('v2 · Plan Dashboard')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'period-summaries', version: '2' })
export class PeriodSummariesV2Controller {
  constructor(private readonly overview: PeriodOverviewService) {}

  @Get()
  @ApiOperation({
    summary:
      'Period grid: target, actual, signed gap, attributed, residual (state), workflow state, run and actuals quality per period',
    description:
      'Keyset on utcStart (ascending). Periods overlapping [from, to); unitIds must be units of the tenant and of the ' +
      'caller’s scope (422 INVALID_REFERENCE). Figures are the shown revision’s plan ledger after its saved decisions ' +
      '(the same arithmetic as GET …/reconciliation), slices summed per period only when they share one unit ' +
      '(else null with flag uom_mixed). Read-only.',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: PeriodSummaryQueryDto,
  ): Promise<ListResponse<PeriodSummaryV2View>> {
    return this.overview.summaries(ctx, query);
  }
}

/** Ledger waterfall of periods (plan 3.5, PlanWaterfallChart): bars that close exactly to actual. */
@ApiTags('v2 · Plan Dashboard')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'reports', version: '2' })
export class WaterfallReportV2Controller {
  constructor(private readonly overview: PeriodOverviewService) {}

  @Get('waterfall')
  @ApiOperation({
    summary:
      'Waterfall of one ledger for 1–31 periods: opening (plan target or capacity), signed steps with start / end, closing actual',
    description:
      'Plan ledger: target → availability → performance → quality → bridge / classified / gain → tolerance adjustment → ' +
      'unaccounted / over-accounted / overproduction → actual, after the saved decisions of the shown revision. ' +
      'Capacity ledger: capacity → exclusion → A → P → Q → gain → residual → good. `closes` = opening + Σ steps equals ' +
      'actual exactly; slices with unknown figures are listed in `excluded`. Periods of another tenant or outside the ' +
      'caller’s scope are 422 INVALID_REFERENCE; different units of measure 422 UOM_MIXED.',
  })
  waterfall(
    @Ctx() ctx: RequestContext,
    @Query() query: WaterfallQueryDto,
  ): Promise<WaterfallV2View> {
    return this.overview.waterfall(ctx, query);
  }
}
