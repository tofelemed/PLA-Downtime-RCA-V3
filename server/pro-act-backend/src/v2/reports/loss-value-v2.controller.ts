import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { AnalyticsResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { LossValueReportView } from './loss-value-report';
import { LossValueReportQueryDto } from './loss-value-v2.dto';
import { LossValueReportV2Service } from './loss-value-v2.service';

/** Valuation report of plan 2.6 (VAL01–VAL03): loss value per view, reporting currency and group. */
@ApiTags('v2 · Valuation')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'reports', version: '2' })
export class LossValueReportV2Controller {
  constructor(private readonly reports: LossValueReportV2Service) {}

  @Get('loss-value')
  @ApiOperation({
    summary:
      'Loss value of one view (margin, standard cost, operational cost) per group and reporting currency (IRR, USD)',
    description:
      'Sums the stored valuation totals of the shown runs (approved revision, else the open draft — provisional); ' +
      'views are never added to each other; an amount is null when a contributing line has no approved FX rate ' +
      '(fx_rate_missing) or nothing is valued; unvalued quantities are listed per unit of measure. unitIds must be ' +
      'units of the tenant and the caller’s scope (422 INVALID_REFERENCE); omitted, a unit-limited caller gets its ' +
      'own units only. Window ≤ 400 days by period start.',
  })
  lossValue(
    @Ctx() ctx: RequestContext,
    @Query() query: LossValueReportQueryDto,
  ): Promise<AnalyticsResponse<LossValueReportView>> {
    return this.reports.lossValue(ctx, query);
  }
}
