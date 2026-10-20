import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { AnalyticsResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { EventStatusView } from './event-status';
import {
  EventStatusQueryDto,
  ProductionByProductQueryDto,
} from './ops-reports-v2.dto';
import { OpsReportsV2Service } from './ops-reports-v2.service';
import { ProductionByProductView } from './production-by-product';

const SCOPE_NOTE =
  'unitIds must be units of the tenant and the caller’s scope (422 INVALID_REFERENCE); omitted, a ' +
  'unit-limited caller gets its own units only. Window ≤ 400 days.';

/** Persona reports R1–R12 (`plans/REPORTS_R1_R12.md`): daily, shift and monthly operating reports. */
@ApiTags('v2 · Operating reports')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'reports', version: '2' })
export class OpsReportsV2Controller {
  constructor(private readonly reports: OpsReportsV2Service) {}

  @Get('production-by-product')
  @ApiOperation({
    summary:
      'Capacity, plan target, actual output and quality classes (prime, wide spec, downgrade, transition off-grade, scrap, rework) per product',
    description:
      'Reads the shown run of each period starting in the window (approved revision, else the open draft — ' +
      'provisional): the capacity and plan ledger totals and the actuals of each product slice. primeYield = ' +
      'Σ prime / Σ gross; planAttainment = Σ actual / Σ target. Units of measure are never mixed. ' +
      SCOPE_NOTE,
  })
  productionByProduct(
    @Ctx() ctx: RequestContext,
    @Query() query: ProductionByProductQueryDto,
  ): Promise<AnalyticsResponse<ProductionByProductView>> {
    return this.reports.productionByProduct(ctx, query);
  }

  @Get('event-status')
  @ApiOperation({
    summary:
      'Running, uncoded, coded and verified loss events (downtime, slowdown, quality loss, grade transition) starting in the window',
    description: `Live events only (not superseded or retracted); approvedOnly has no effect. ${SCOPE_NOTE}`,
  })
  eventStatus(
    @Ctx() ctx: RequestContext,
    @Query() query: EventStatusQueryDto,
  ): Promise<EventStatusView> {
    return this.reports.eventStatus(ctx, query);
  }
}
