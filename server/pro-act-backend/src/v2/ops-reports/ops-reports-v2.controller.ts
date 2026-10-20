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
  QualityDispositionsQueryDto,
  RestatementsQueryDto,
  ShiftHandoverQueryDto,
  TransitionPerformanceQueryDto,
} from './ops-reports-v2.dto';
import { TransitionPerformanceView } from './transition-performance';
import { QualityDispositionsView } from './quality-dispositions';
import { RestatementsView } from './restatements-report';
import { OpsReportsV2Service } from './ops-reports-v2.service';
import { ProductionByProductView } from './production-by-product';
import { ShiftHandoverView } from './shift-handover';

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

  @Get('shift-handover')
  @ApiOperation({
    summary:
      'One shift on the caller’s units: output per product, loss events and their coding, handover notes',
    description:
      'The shift window comes from the stored shift instances of localDate and shiftName (earliest start to ' +
      'latest end over the units); production reads the shown runs of the periods of that shift; events are ' +
      'the live loss events overlapping the window (also still running ones), at most 100 (eventsTruncated). ' +
      'No unit with that shift: empty figures, notes only. unitIds as for the other reports (422 INVALID_REFERENCE).',
  })
  shiftHandover(
    @Ctx() ctx: RequestContext,
    @Query() query: ShiftHandoverQueryDto,
  ): Promise<AnalyticsResponse<ShiftHandoverView>> {
    return this.reports.shiftHandover(ctx, query);
  }

  @Get('restatements')
  @ApiOperation({
    summary:
      'Restatements of the window’s periods: approved revisions that replaced an approved one, with posting and good-output change',
    description:
      'Periods of the units starting in the window; newest approval first, at most 200 (truncated). goodBefore / ' +
      'goodAfter: capacity-ledger good output of the replaced and the replacing revision’s run; goodDelta their ' +
      `difference. treatment / postingDate: finance’s posting decision, null while none. ${SCOPE_NOTE}`,
  })
  restatements(
    @Ctx() ctx: RequestContext,
    @Query() query: RestatementsQueryDto,
  ): Promise<RestatementsView> {
    return this.reports.restatements(ctx, query);
  }

  @Get('quality-dispositions')
  @ApiOperation({
    summary:
      'Lot dispositions of lots produced in the window by class, decision state and product, with the pending decisions',
    description:
      'Live dispositions only (superseded ones left out); quantity per unit of measure, never converted. ' +
      `pending / oldestPendingAt: proposals still waiting for the quality decision. ${SCOPE_NOTE}`,
  })
  qualityDispositions(
    @Ctx() ctx: RequestContext,
    @Query() query: QualityDispositionsQueryDto,
  ): Promise<QualityDispositionsView> {
    return this.reports.qualityDispositions(ctx, query);
  }

  @Get('transition-performance')
  @ApiOperation({
    summary:
      'Grade transitions against their approved standard: duration, excess over the reference, loss within and over the allowance',
    description:
      'Live grade transitions of the units starting in the window, newest first, at most 500 (truncated). The ' +
      'standard is the one the calculation applied (its line flag) and the loss is the capacity-ledger lines of ' +
      'the shown runs of the window’s periods; calculated = false while no shown run has lines of the transition. ' +
      `pairs: per product change over the listed transitions (means of ended ones). ${SCOPE_NOTE}`,
  })
  transitionPerformance(
    @Ctx() ctx: RequestContext,
    @Query() query: TransitionPerformanceQueryDto,
  ): Promise<TransitionPerformanceView> {
    return this.reports.transitionPerformance(ctx, query);
  }
}
