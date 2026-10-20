import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Ctx } from '../../common/context/ctx.decorator';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { ListResponse, listResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { ReconciliationExceptionsQueryDto } from './exceptions-v2.dto';
import { ReconciliationExceptionsService } from './exceptions-v2.service';
import { ReconciliationExceptionV2View } from './exceptions-v2.view';

/** Plan 2.4: the accounting exceptions queue of month close. Reads: any tenant member in scope. */
@ApiTags('v2 · Reconciliation and approval')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'reconciliation', version: '2' })
export class ReconciliationExceptionsV2Controller {
  constructor(private readonly exceptions: ReconciliationExceptionsService) {}

  @Get('exceptions')
  @ApiOperation({
    summary:
      'Open accounting problems of the periods that are not approved: one row per period and problem type',
    description:
      'Types, from stored state only (nothing is recalculated on read): residual_beyond_tolerance, ' +
      'claim_exceeds_component, bridge_required, plan_allocation_required (flags of the latest run’s slice ' +
      'totals), stale_submission, substitute_source (actuals of the latest run from a substitute source), ' +
      'uncoded_stop_time (live stops of the period without a reason, not marked investigation pending) and ' +
      'duplicate_merge_pending (suggested duplicate-stop pairs whose kept stop overlaps the period). ' +
      'Periods of the operational dates [fromDate, toDate) in the caller’s unit scope; keyset on period start, ' +
      'period and type. Each row has a short message and the screen that fixes it.',
  })
  async list(
    @Ctx() ctx: RequestContext,
    @Query() query: ReconciliationExceptionsQueryDto,
  ): Promise<ListResponse<ReconciliationExceptionV2View>> {
    const page = await this.exceptions.page(ctx, query);
    return listResponse(page.items, page.nextCursor, {
      tenantId: requireTenantId(ctx),
      ...(page.unitIds ? { unitIds: page.unitIds } : {}),
    });
  }
}
