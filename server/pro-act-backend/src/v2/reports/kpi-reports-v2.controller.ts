import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { AnalyticsResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import {
  DowntimeBundleQueryDto,
  DowntimeReportQueryDto,
  OeeReportQueryDto,
  ReliabilityReportQueryDto,
} from './kpi-reports-v2.dto';
import { KpiReportsV2Service } from './kpi-reports-v2.service';
import {
  DowntimeBundleView,
  DowntimeReportView,
  OeeReportView,
  ReliabilityReportView,
} from './kpi-reports-v2.view';

const SCOPE_NOTE =
  'Reads stored KPI terms of the shown runs (approved revision, else the open draft — provisional); never ' +
  'computes on read. unitIds must be units of the tenant and the caller’s scope (422 INVALID_REFERENCE); ' +
  'omitted, a unit-limited caller gets its own units only. Window ≤ 400 days by period start.';

/** KPI reports of plan 2.7 (KPI01–KPI08, AN03, API03): OEE, downtime and reliability read models. */
@ApiTags('v2 · KPI reports')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'reports', version: '2' })
export class KpiReportsV2Controller {
  constructor(private readonly reports: KpiReportsV2Service) {}

  @Get('oee')
  @ApiOperation({
    summary:
      'Operational (ISO 22400) or reconciled (GE PLA, labelled) OEE per site-local group: Σ numerators / Σ denominators',
    description: SCOPE_NOTE,
  })
  oee(
    @Ctx() ctx: RequestContext,
    @Query() query: OeeReportQueryDto,
  ): Promise<AnalyticsResponse<OeeReportView>> {
    return this.reports.oee(ctx, query);
  }

  @Get('downtime')
  @ApiOperation({
    summary:
      'Downtime seconds or stop frequency by reason, reason level 1, impact, OEE component, asset, shift, crew or time',
    description: SCOPE_NOTE,
  })
  downtime(
    @Ctx() ctx: RequestContext,
    @Query() query: DowntimeReportQueryDto,
  ): Promise<AnalyticsResponse<DowntimeReportView>> {
    return this.reports.downtime(ctx, query);
  }

  @Get('downtime-bundle')
  @ApiOperation({
    summary:
      'Several downtime breakdowns (views) from one run selection, window and unit set (T24)',
    description:
      `${SCOPE_NOTE} Each views token is <groupBy>[:duration|frequency][:<scheduleClass>]; every view ` +
      'equals `/reports/downtime` with that groupBy, metric and scheduleClass (no reason drill: use ' +
      '`/reports/downtime` with parentReasonId). The period summary and calculationRunIds are shared.',
  })
  downtimeBundle(
    @Ctx() ctx: RequestContext,
    @Query() query: DowntimeBundleQueryDto,
  ): Promise<AnalyticsResponse<DowntimeBundleView>> {
    return this.reports.downtimeBundle(ctx, query);
  }

  @Get('reliability')
  @ApiOperation({
    summary:
      'MTBF, mean downtime to restore and MTTR (repair evidence only) per unit and asset (D13 failure definition)',
    description: `${SCOPE_NOTE} assetIds must be assets of the tenant on those units (422 INVALID_REFERENCE).`,
  })
  reliability(
    @Ctx() ctx: RequestContext,
    @Query() query: ReliabilityReportQueryDto,
  ): Promise<AnalyticsResponse<ReliabilityReportView>> {
    return this.reports.reliability(ctx, query);
  }
}
