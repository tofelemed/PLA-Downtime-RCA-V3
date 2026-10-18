import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import {
  RcaCauseReportService,
  RcaCauseReportV2View,
} from '../../rca-case/rca-cause-report.service';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { RcaCauseReportQueryDto } from '../rca/rca-case-causes-v2.dto';

/** Recurring causes across RCA cases (item 7 groundwork). */
@ApiTags('v2 · RCA')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'reports', version: '2' })
export class RcaCauseReportV2Controller {
  constructor(private readonly reports: RcaCauseReportService) {}

  @Get('rca-causes')
  @ApiOperation({
    summary:
      'Catalogue causes ranked by the number of cases naming them, with the approved loss of those cases',
    description:
      'Cases of your tenant and units (unitId narrows it; kind filters the cause kind). Top `limit` (max 50) ' +
      'by cases; approved loss = events and loss lines linked to those cases, approved revisions only, in the ' +
      'policy default valuation view (null amount when not valued, never estimated). sort=approvedLoss ' +
      'orders that top set by the amount in `currency` (default USD).',
  })
  report(
    @Ctx() ctx: RequestContext,
    @Query() query: RcaCauseReportQueryDto,
  ): Promise<RcaCauseReportV2View> {
    return this.reports.report(ctx, query);
  }
}
