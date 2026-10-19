import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { assertMoneyVisible } from '../../auth/money/money-access';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { AnalyticsResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { BadActorReportQueryDto } from './bad-actor-v2.dto';
import {
  BadActorReportV2Service,
  BadActorReportView,
} from './bad-actor-v2.service';

/** CA8 bad-actor review (SME 14 Oct 2026): top assets / failure modes of a rolling window. */
@ApiTags('v2 · RCA')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'reports', version: '2' })
export class BadActorReportV2Controller {
  constructor(private readonly reports: BadActorReportV2Service) {}

  @Get('bad-actors')
  @ApiOperation({
    summary:
      'Monthly bad-actor review: top assets or asset failure modes by approved loss, approved value or stops',
    description:
      'CA8: the rolling window of the tenant RCA policy (pilot 90 days) ending at the end of `month` in the ' +
      'plant time zone. Approved lost quantity and value come from approved periods only (value in the ' +
      'view frozen when the periods were approved, else the policy default view — `viewSource`, SME V8; null when not valued, never zero; fxProvisional when a provisional FX ' +
      'rate converted it); stops = unplanned stops and failure work orders. Ranked on the server, top ' +
      '`limit` (≤ 50). Each item carries the cumulative bad-actor trigger state of its asset (fired, ' +
      'over_threshold, below, off). unitIds must be units of the tenant and the caller’s scope (422 ' +
      'INVALID_REFERENCE); omitted, a unit-limited caller gets its own units only. A month key whose year ' +
      'belongs to the other calendar (1405-07 on a Gregorian plant) is 422 MONTH_KEY_AMBIGUOUS.',
  })
  badActors(
    @Ctx() ctx: RequestContext,
    @Query() query: BadActorReportQueryDto,
  ): Promise<AnalyticsResponse<BadActorReportView>> {
    // QA re-test 2026-10-19: ranking by value is a money ranking; the item values are withheld anyway
    if (query.rankBy === 'value') assertMoneyVisible(ctx);
    return this.reports.report(ctx, query);
  }
}
