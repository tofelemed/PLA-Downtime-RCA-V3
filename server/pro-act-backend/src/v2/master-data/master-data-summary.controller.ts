import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import {
  MasterDataSummaryV2Service,
  MasterDataSummaryV2View,
} from './master-data-summary.service';

/** Overview counts of the Master Data landing page. */
@ApiTags('v2 · Master Data')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'master-data', version: '2' })
export class MasterDataSummaryV2Controller {
  constructor(private readonly summaries: MasterDataSummaryV2Service) {}

  @Get('summary')
  @ApiOperation({
    summary: 'Active master-data record counts of the acting plant',
    description:
      'Units, assets, products (plant and organisation), RCA templates, causes and verification checklists. ' +
      'Unit-scoped callers count only their units and those units’ assets.',
  })
  summary(@Ctx() ctx: RequestContext): Promise<MasterDataSummaryV2View> {
    return this.summaries.summary(ctx);
  }
}
