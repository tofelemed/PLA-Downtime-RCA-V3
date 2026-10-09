import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { ActualsJobsService } from '../../periods/actuals-jobs.service';
import { MaterializeResult } from '../../periods/period-materializer.service';
import { PeriodsService } from '../../periods/periods.service';
import { RevisionLifecycleService } from '../../reconciliation/revision-lifecycle.service';
import { RecomputeRequestDto } from '../reconciliation/reconciliation-v2.dto';
import {
  AnalyticsResponse,
  JobAccepted,
  ListResponse,
} from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { MaterializePeriodsDto, PeriodListQueryDto } from './period-v2.dto';
import { PERIOD_WRITERS } from './period-roles';
import { PeriodDetailV2View, PeriodV2View } from './period-v2.view';
import { PeriodsV2Service } from './periods-v2.service';

/** Production periods and their actuals (plan 2.4, ACT01–ACT08, §3.1). */
@ApiTags('v2 · Production periods')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'production-periods', version: '2' })
export class ProductionPeriodsV2Controller {
  constructor(
    private readonly reads: PeriodsV2Service,
    private readonly periods: PeriodsService,
    private readonly jobs: ActualsJobsService,
    private readonly lifecycle: RevisionLifecycleService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Period grid with the authoritative actuals of every active slice (keyset on utcStart, id)',
    description:
      'Filters: unitIds, productIds (active slice of the product), readiness, from/to (overlap). Unit-limited ' +
      'callers see their units only. Decimals are strings; null = unknown, never zero.',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: PeriodListQueryDto,
  ): Promise<ListResponse<PeriodV2View>> {
    return this.reads.list(ctx, query);
  }

  @Post('materialize')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...PERIOD_WRITERS)
  @ApiOperation({
    summary:
      'Create the periods of stored shift instances starting in [from, to) (backfill, ≤ 92 days)',
    description:
      'Requires `Idempotency-Key`. unitIds must be of the tenant and the caller’s scope (422 INVALID_REFERENCE); ' +
      'without unitIds every unit with an approved profile is materialized (403 TENANT_SCOPE_REQUIRED for ' +
      'unit-limited callers). Existing periods are kept; instances overlapping a period with other bounds are skipped.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  materialize(
    @Ctx() ctx: RequestContext,
    @Body() body: MaterializePeriodsDto,
  ): Promise<MaterializeResult> {
    return this.periods.materialize(ctx, body);
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'One period: slices, actuals with method, coverage, provenance segments and findings, adjustments',
    description:
      '`calculationRunId` is the current actuals run (2.5 calculation runs reference it). Foreign ids are 404.',
  })
  get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<AnalyticsResponse<PeriodDetailV2View>> {
    return this.reads.get(ctx, id);
  }

  @Post(':id/recompute')
  @HttpCode(HttpStatus.ACCEPTED)
  @Idempotent()
  @Roles(...PERIOD_WRITERS)
  @ApiOperation({
    summary:
      'Queue a recomputation of the period’s actuals and loss ledgers (202 + job)',
    description:
      'Requires `Idempotency-Key`. A new actuals run is written only when an input changed; otherwise the ' +
      'current result is kept (`reused: true` in the job result). A stale in-review revision returns to draft ' +
      'first (plan 2.8: recompute, then resubmit); the request is recorded on the revision history.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async recompute(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: RecomputeRequestDto,
  ): Promise<JobAccepted> {
    await this.lifecycle.prepareRecompute(ctx, id, body.reason ?? null);
    const job = await this.jobs.requestRecompute(ctx, id);
    return { jobId: job.id, statusUrl: `/api/v2/actuals-jobs/${job.id}` };
  }
}
