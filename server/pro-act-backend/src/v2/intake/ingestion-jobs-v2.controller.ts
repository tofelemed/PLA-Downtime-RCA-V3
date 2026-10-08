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
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { IngestionJobsService } from '../../intake/jobs/ingestion-jobs.service';
import { JOB_ACTIONS, JobAction } from '../../intake/jobs/job-transitions';
import { ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import {
  IngestionJobListQueryDto,
  JobCommandV2Dto,
} from './ingestion-job-v2.dto';
import { IntakeQueriesV2Service } from './intake-queries-v2.service';
import { INTEGRATION_WRITERS } from './intake-roles';
import {
  IngestionJobV2View,
  JobTransitionV2View,
  toJobView,
} from './intake-v2.view';
import { JobActionPipe } from './job-action.pipe';

/** Leased ingestion jobs (plan 1.5, ING02, API04): status, audit trail and lifecycle commands. */
@ApiTags('v2 · Ingestion Jobs')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'ingestion-jobs', version: '2' })
export class IngestionJobsV2Controller {
  constructor(
    private readonly queries: IntakeQueriesV2Service,
    private readonly jobs: IngestionJobsService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'List ingestion jobs of the caller tenant (keyset on createdAt, id)',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: IngestionJobListQueryDto,
  ): Promise<ListResponse<IngestionJobV2View>> {
    return this.queries.listJobs(ctx, query);
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'One job: state, lease, committed cursor, retries, health; foreign ids are 404',
  })
  async get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<IngestionJobV2View> {
    return toJobView(await this.jobs.get(ctx, id));
  }

  @Get(':id/transitions')
  @ApiOperation({
    summary:
      'Audit trail of the job (commands, lease take-overs, drained, failed), oldest first',
  })
  async transitions(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<JobTransitionV2View[]> {
    await this.jobs.get(ctx, id);
    return this.queries.jobTransitions(ctx, id);
  }

  @Post(':id/:action')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @Roles(...INTEGRATION_WRITERS)
  @ApiParam({ name: 'action', enum: JOB_ACTIONS })
  @ApiOperation({
    summary: 'start | pause | resume | drain | stop a job (audited)',
    description:
      'Requires `Idempotency-Key`. pause/stop let the in-flight page finish (its cursor is committed); ' +
      'drain stops once the source is caught up. 409 INVALID_TRANSITION when the state does not allow ' +
      'the command; 409 JOB_SCOPE_EXISTS when starting would duplicate an active scope.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async command(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('action', JobActionPipe) action: JobAction,
    @Body() body: JobCommandV2Dto,
  ): Promise<IngestionJobV2View> {
    return toJobView(await this.jobs.command(ctx, id, action, body.reason));
  }
}
