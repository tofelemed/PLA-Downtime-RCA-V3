import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { AnalyticsResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { LossStatementQueryDto } from './loss-statement.dto';
import {
  LossStatementReportView,
  LossStatementV2Service,
} from './loss-statement-v2.service';

/** PLA "Accounting statement" page (Task 13, owner requirement 27 Oct 2026). */
@ApiTags('v2 · PLA analytics')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'reports', version: '2' })
export class LossStatementV2Controller {
  constructor(private readonly statements: LossStatementV2Service) {}

  @Get('loss-statement')
  @ApiOperation({
    summary:
      'Loss accounting statement of a window and units: planned, actual, shortfall, losses by kind, gross attributed, verified recovery, net accounted, tolerance adjustment, unaccounted',
    description:
      'Read-only. Periods starting in [from, to) (≤ 400 days); unitIds must be units of the tenant and the caller’s scope ' +
      '(422 INVALID_REFERENCE), omitted: every unit the caller may read. `total` sums the complete periods of the window ' +
      '(server-side, from the shown revisions’ reconciled plan ledgers); `items` is a keyset page of the periods in ' +
      '(local date, start, id) order, each with its statement; `incomplete` counts the periods left out of the total. ' +
      'revision=approved: approved revisions only; provisional (default): approved, else the open draft. ' +
      'Identity: shortfall = netAccounted + toleranceAdjustment + unaccounted; netAccounted = grossAttributed − recovery.',
  })
  lossStatement(
    @Ctx() ctx: RequestContext,
    @Query() query: LossStatementQueryDto,
  ): Promise<AnalyticsResponse<LossStatementReportView>> {
    return this.statements.report(ctx, query);
  }
}
