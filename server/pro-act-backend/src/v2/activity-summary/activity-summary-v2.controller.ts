import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { ActivitySummaryQueryDto } from './activity-summary-v2.dto';
import { ActivitySummaryV2Service } from './activity-summary-v2.service';
import { ActivitySummaryResponse } from './activity-summary.view';

/** Work-item and audit activity of a window for the Reports screen (v1 RCA / task / audit summaries on v2). */
@ApiTags('v2 · KPI reports')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'reports', version: '2' })
export class ActivitySummaryV2Controller {
  constructor(private readonly activity: ActivitySummaryV2Service) {}

  @Get('activity-summary')
  @ApiOperation({
    summary:
      'RCA cases and tasks created in the window by status, priority and plant-local day (open, overdue); audit entries by action, entity type and day for audit readers',
    description:
      'Counts in SQL over records created in [from, to) (≤ 400 days, 422 INVALID_RANGE / WINDOW_TOO_LARGE). ' +
      'Tenant from identity; RCA cases of a unit-limited caller are those of its units; `audit` is null ' +
      'unless the caller may read the audit log (SuperAdmin, OrgAdmin, TenantAdmin, manager approver). Days ' +
      'are counted in the plant timezone (default site, else the plant, else UTC).',
  })
  summary(
    @Ctx() ctx: RequestContext,
    @Query() query: ActivitySummaryQueryDto,
  ): Promise<ActivitySummaryResponse> {
    return this.activity.summary(ctx, query);
  }
}
