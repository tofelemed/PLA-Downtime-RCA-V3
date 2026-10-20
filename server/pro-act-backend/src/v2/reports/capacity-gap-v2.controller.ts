import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { CapacityGapQueryDto } from './capacity-gap-v2.dto';
import { CapacityGapReportV2Service } from './capacity-gap-v2.service';
import { CapacityGapReportView } from './capacity-gap-v2.view';

/** Capacity gap report (plan 1.2): approved rate kinds side by side per unit and product. */
@ApiTags('v2 · Profiles')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'reports', version: '2' })
export class CapacityGapReportV2Controller {
  constructor(private readonly reports: CapacityGapReportV2Service) {}

  @Get('capacity-gap')
  @ApiOperation({
    summary:
      'Approved nameplate, demonstrated, sustained and planning rates side by side, with the gap between each step',
    description:
      'One row per approved profile (unit, product, operating mode) in force at `at` (default now), with the ' +
      'approved rate version of each kind in force then (budget and forecast shown as references). A kind ' +
      'without one is null ("not set"); nothing is inferred. gaps: nameplate − demonstrated, demonstrated − ' +
      'sustained, sustained − planning (decimal strings; ratio = gap / upper); ratios: sustained / nameplate ' +
      'and planning / sustained. Null with reason not_set, uom_mismatch, timebase_mismatch (never converted) ' +
      'or zero_base. unitIds must be units of the tenant and the caller’s scope (422 INVALID_REFERENCE); ' +
      'omitted, a unit-limited caller gets its own units. At most `limit` (≤ 200) rows by unit, product and ' +
      'mode; `truncated` when more match.',
  })
  report(
    @Ctx() ctx: RequestContext,
    @Query() query: CapacityGapQueryDto,
  ): Promise<CapacityGapReportView> {
    return this.reports.report(ctx, query);
  }
}
