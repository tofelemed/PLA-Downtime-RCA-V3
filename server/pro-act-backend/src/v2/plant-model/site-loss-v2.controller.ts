import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { SiteLossView } from '../../domain/accounting/site-consolidation';
import { AnalyticsResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { SiteLossQueryDto } from './plant-flow-v2.dto';
import { SiteLossV2Service } from './site-loss-v2.service';

/** SME E2 / Q13: loss consolidated at the site boundary of the material-flow map. */
@ApiTags('v2 · PLA analytics')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'reports', version: '2' })
export class SiteLossV2Controller {
  constructor(private readonly reports: SiteLossV2Service) {}

  @Get('site-loss')
  @ApiOperation({
    summary:
      'Loss at the site boundary by origin, next to every unit’s own loss (impact), per unit of measure',
    description:
      'Read-only over the stored runs and approved lines of periods starting in [from, to) (≤ 400 days). Boundary units feed ' +
      'no other unit in the approved flow map at the period start; only they add to the site loss, so an upstream stop counts ' +
      'once — where it starved a boundary unit, attributed to its unit — and one the buffer absorbed costs the site nothing.',
  })
  siteLoss(
    @Ctx() ctx: RequestContext,
    @Query() query: SiteLossQueryDto,
  ): Promise<AnalyticsResponse<SiteLossView & { ledger: string }>> {
    return this.reports.siteLoss(ctx, query);
  }
}
