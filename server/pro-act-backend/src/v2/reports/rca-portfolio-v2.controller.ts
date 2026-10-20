import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import {
  RcaPortfolioService,
  RcaPortfolioV2View,
} from '../../rca-case/portfolio/rca-portfolio.service';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { RcaPortfolioQueryDto } from './rca-portfolio-v2.dto';

/** Loss → cause → action → outcome portfolio (item 2.1). */
@ApiTags('v2 · RCA')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'reports', version: '2' })
export class RcaPortfolioV2Controller {
  constructor(private readonly portfolio: RcaPortfolioService) {}

  @Get('rca-portfolio')
  @ApiOperation({
    summary:
      'Cases of your scope opened in a window, by coded cause: approved loss, actions, verdicts, claims and realised differences',
    description:
      'Rows group the cases by the catalogue code of their causes of `causeKind` (root by default); cases ' +
      'without one form the Uncoded row (key `uncoded`). Keyset pages ordered by number of cases (`limit` ≤ 50, ' +
      '`cursor`). Approved loss = linked events and loss lines, approved revisions only, in `currency` (USD ' +
      'default, IRR); claimed avoided loss is the owners’ figure in that currency; realised difference is per ' +
      'verification metric. The three are never added together. Money is left out for roles without it.',
  })
  report(
    @Ctx() ctx: RequestContext,
    @Query() query: RcaPortfolioQueryDto,
  ): Promise<RcaPortfolioV2View> {
    return this.portfolio.report(ctx, query);
  }
}
