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
  ReliabilityTrendQueryDto,
  TransitionPerformanceQueryDto,
  ChronicSporadicQueryDto,
  RateLossQueryDto,
  CodingComplianceQueryDto,
} from './ops-reports-v2.dto';
import { CodingComplianceView } from './coding-compliance';
import { RateLossView } from './rate-loss';
import { ChronicSporadicView } from './chronic-sporadic';
import { ReliabilityTrendView } from './reliability-trend';
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

  @Get('reliability-trend')
  @ApiOperation({
    summary:
      'MTBF, mean time to restore and MTTR per plant month for each unit and its most-failing assets',
    description:
      'The stored terms of the shown runs summed per plant month (YYYY-MM of the period date), with the ' +
      'definitions of /reports/reliability (unknown state time left out of unit exposure; an asset is exposed ' +
      'while its unit runs). Assets: at most 30, those with the most eligible failures. fallingMtbf: MTBF fell ' +
      `in each of the last three months that have a value. ${SCOPE_NOTE}`,
  })
  reliabilityTrend(
    @Ctx() ctx: RequestContext,
    @Query() query: ReliabilityTrendQueryDto,
  ): Promise<AnalyticsResponse<ReliabilityTrendView>> {
    return this.reports.reliabilityTrend(ctx, query);
  }

  @Get('chronic-sporadic')
  @ApiOperation({
    summary:
      'Unplanned stops per reason or asset: occurrences, seconds, mean length and chronic / sporadic / major / minor quadrant',
    description:
      'From the stored downtime breakdown cells of the shown runs (unplanned and unknown schedule class — never planned or external —, micro-stops included; seconds ' +
      'allocated per cause as in /reports/downtime). Quadrants are cut at the medians of the rows with stops ' +
      '(medianStops, medianMeanSeconds; a tie counts as high): frequent+short = chronic, rare+long = sporadic, ' +
      `both high = major, both low = minor. Largest seconds first, at most 100 rows (truncated). ${SCOPE_NOTE}`,
  })
  chronicSporadic(
    @Ctx() ctx: RequestContext,
    @Query() query: ChronicSporadicQueryDto,
  ): Promise<AnalyticsResponse<ChronicSporadicView>> {
    return this.reports.chronicSporadic(ctx, query);
  }

  @Get('rate-loss')
  @ApiOperation({
    summary:
      'Equivalent downtime of running below rate and the performance component, per plant month and in total',
    description:
      'Σ of the stored period terms of the shown runs: downtime_equivalent = fraction × duration of the ' +
      'partial-impact events (time at the reference rate, SME Q5), performance = operational OEE performance. ' +
      `The loss by cause is /reports/loss-tree with kinds=performance. ${SCOPE_NOTE}`,
  })
  rateLoss(
    @Ctx() ctx: RequestContext,
    @Query() query: RateLossQueryDto,
  ): Promise<AnalyticsResponse<RateLossView>> {
    return this.reports.rateLoss(ctx, query);
  }

  @Get('coding-compliance')
  @ApiOperation({
    summary:
      'Per crew and shift: stops coded and verified, coding delay (median, p90) and the coded-downtime and state-coverage KPIs',
    description:
      'Stops: ended downtime events starting in the window, attributed to the crew and shift of the shift ' +
      'instance holding their start. Delay: from the stop’s end to its first coding with a reason (whole ' +
      'seconds, never negative). KPIs: Σ of the stored period terms of the shown runs per crew / shift label. ' +
      `A null key = no crew (or shift) recorded. ${SCOPE_NOTE}`,
  })
  codingCompliance(
    @Ctx() ctx: RequestContext,
    @Query() query: CodingComplianceQueryDto,
  ): Promise<AnalyticsResponse<CodingComplianceView>> {
    return this.reports.codingCompliance(ctx, query);
  }
}
