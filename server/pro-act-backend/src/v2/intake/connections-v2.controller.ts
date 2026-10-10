import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { IfMatch } from '../../common/concurrency/revision';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import {
  ConnectionTest,
  SourceSample,
} from '../../intake/adapters/adapter.interface';
import { IntegrationConnectionService } from '../../intake/connections/integration-connection.service';
import { IngestionJobsService } from '../../intake/jobs/ingestion-jobs.service';
import { ReplayService } from '../../intake/replay/replay.service';
import { JobAccepted, ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import {
  ConnectionSampleQueryV2Dto,
  UpdateConnectionV2Dto,
} from './connection-change-v2.dto';
import {
  ConnectionListQueryDto,
  CreateConnectionV2Dto,
} from './connection-v2.dto';
import {
  CreateIngestionJobV2Dto,
  CreateReplayV2Dto,
} from './ingestion-job-v2.dto';
import { IntakeQueriesV2Service } from './intake-queries-v2.service';
import { INTEGRATION_WRITERS, REPLAY_ROLES } from './intake-roles';
import {
  ConnectionV2View,
  IngestionJobV2View,
  toConnectionView,
  toJobView,
} from './intake-v2.view';

const IDEMPOTENCY_HEADER = { name: 'Idempotency-Key', required: true };
const SAMPLE_WINDOW_MS = 31 * 86_400_000;

/** Source connections (plan 1.5, spec §15.2 `/connections`, ING07); secrets are never returned. */
@ApiTags('v2 · Connections')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'connections', version: '2' })
export class ConnectionsV2Controller {
  constructor(
    private readonly queries: IntakeQueriesV2Service,
    private readonly connections: IntegrationConnectionService,
    private readonly jobs: IngestionJobsService,
    private readonly replays: ReplayService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'List connections of the caller tenant (redacted: `hasSecret` only)',
    description:
      'Keyset pages on (createdAt, id); inactive ones with includeInactive=true.',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: ConnectionListQueryDto,
  ): Promise<ListResponse<ConnectionV2View>> {
    return this.queries.listConnections(ctx, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One connection (redacted); foreign ids are 404' })
  async get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ConnectionV2View> {
    return toConnectionView(await this.connections.get(ctx, id));
  }

  @Post()
  @Idempotent()
  @Roles(...INTEGRATION_WRITERS)
  @ApiOperation({
    summary: 'Create a connection',
    description:
      'Requires `Idempotency-Key`. The secret is stored encrypted (`secret_ref`); credential-like keys in ' +
      'endpointConfig are 422 SECRET_IN_CONFIG; the adapter validates the config (422 INVALID_ENDPOINT_CONFIG).',
  })
  @ApiHeader(IDEMPOTENCY_HEADER)
  async create(
    @Ctx() ctx: RequestContext,
    @Body() body: CreateConnectionV2Dto,
  ): Promise<ConnectionV2View> {
    return toConnectionView(await this.connections.create(ctx, body));
  }

  @Patch(':id')
  @Roles(...INTEGRATION_WRITERS)
  @ApiOperation({
    summary:
      'Change a connection (name, endpoint configuration, secret, active)',
    description:
      'Requires `If-Match: "<rowVersion>"` (428 without, 412 when stale). A new secret replaces the stored ' +
      'one and is never returned; endpoint or secret changes bump configVersion. Credential-like keys in ' +
      'endpointConfig are 422 SECRET_IN_CONFIG; mirrors of v1 PI connections are 409 LEGACY_CONNECTION.',
  })
  @ApiHeader({ name: 'If-Match', required: true })
  async update(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @IfMatch() expectedRevision: number,
    @Body() body: UpdateConnectionV2Dto,
  ): Promise<ConnectionV2View> {
    return toConnectionView(
      await this.connections.update(ctx, { id, expectedRevision }, body),
    );
  }

  @Post(':id/test')
  @HttpCode(HttpStatus.OK)
  @Roles(...INTEGRATION_WRITERS)
  @ApiOperation({
    summary:
      'Test the connection through its adapter (no data is read or stored)',
    description:
      '422 ADAPTER_UNAVAILABLE when no adapter for the source type is installed yet.',
  })
  test(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ConnectionTest> {
    return this.connections.test(ctx, id);
  }

  @Get(':id/discover')
  @Roles(...INTEGRATION_WRITERS)
  @ApiOperation({
    summary: 'Adapter capabilities and source metadata (e.g. PI asset servers)',
  })
  discover(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<Record<string, unknown>> {
    return this.connections.discover(ctx, id);
  }

  @Get(':id/sample')
  @Roles(...INTEGRATION_WRITERS)
  @ApiOperation({
    summary:
      'Sample recent source records of one scope with their attribute values (nothing is stored)',
    description:
      'Discovery for mapping (UX06): PI event frames overlapping [from, to) of an AF database or element, ' +
      'at most `limit` (≤ 50) records and 31 days, with records per template. 422 SAMPLE_UNSUPPORTED for ' +
      'adapters that cannot sample, 422 INVALID_RANGE for a bad window; source failures are 502 with the ' +
      "adapter's code (e.g. PI_AUTH_FAILED).",
  })
  sample(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: ConnectionSampleQueryV2Dto,
  ): Promise<SourceSample> {
    const from = new Date(query.from);
    const to = new Date(query.to);
    const span = to.getTime() - from.getTime();
    if (!(span > 0) || span > SAMPLE_WINDOW_MS) {
      throw new UnprocessableEntityException({
        code: 'INVALID_RANGE',
        message: 'from must be before to, and the window at most 31 days',
      });
    }
    return this.connections.sample(ctx, id, {
      scopeType: query.scopeType,
      scopeId: query.scopeId,
      templateName: query.templateName ?? null,
      from,
      to,
      limit: query.limit ?? 20,
    });
  }

  @Post(':id/jobs')
  @Idempotent()
  @Roles(...INTEGRATION_WRITERS)
  @ApiOperation({
    summary: 'Create an ingestion job for a scope of this connection (ING02)',
    description:
      'Requires `Idempotency-Key`. 409 JOB_SCOPE_EXISTS when a non-stopped job has the same scope. ' +
      '`start: true` starts it (the worker claims it under a lease).',
  })
  @ApiHeader(IDEMPOTENCY_HEADER)
  async createJob(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: CreateIngestionJobV2Dto,
  ): Promise<IngestionJobV2View> {
    return toJobView(await this.jobs.create(ctx, id, body));
  }

  @Post(':id/replays')
  @Idempotent()
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles(...REPLAY_ROLES)
  @ApiOperation({
    summary: 'Replay retained raw observations of this connection (ING05)',
    description:
      'Requires `Idempotency-Key`. The latest retained version of each source object in scope (window on ' +
      'the observation time, source object ids, exception ids) is re-delivered with its original identity ' +
      'and normalised with the current mappings. 202 with the replay run (`GET /replay-runs/{id}`).',
  })
  @ApiHeader(IDEMPOTENCY_HEADER)
  @ApiResponse({ status: 202, description: 'Replay run accepted' })
  async replay(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: CreateReplayV2Dto,
  ): Promise<JobAccepted> {
    const run = await this.replays.request(ctx, id, {
      ...body,
      from: body.from ? new Date(body.from) : undefined,
      to: body.to ? new Date(body.to) : undefined,
    });
    return { jobId: run.id, statusUrl: `/api/v2/replay-runs/${run.id}` };
  }
}
