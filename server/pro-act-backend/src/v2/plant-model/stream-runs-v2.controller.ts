import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { StreamRunsService } from '../../plant-model/stream-runs.service';
import { ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { PERIOD_WRITERS } from '../periods/period-roles';
import {
  StreamRunCreateDto,
  StreamRunListQueryDto,
  StreamRunPatchDto,
} from './unit-stream-v2.dto';
import { StreamRunV2View, toStreamRunView } from './unit-stream-v2.view';
import { UnitStreamsV2Service } from './unit-streams-v2.service';

/**
 * Which product each stream runs over time and the lot it makes (SME E6): an operational record of
 * production. Lot-coded output measured downstream (silo, packaging) keeps the grade of its run.
 */
@ApiTags('v2 · Profiles')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'stream-runs', version: '2' })
export class StreamRunsV2Controller {
  constructor(
    private readonly lists: UnitStreamsV2Service,
    private readonly runs: StreamRunsService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'List stream runs overlapping [from, to) (keyset on startTime, id, newest first)',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: StreamRunListQueryDto,
  ): Promise<ListResponse<StreamRunV2View>> {
    return this.lists.listRuns(ctx, query);
  }

  @Post()
  @Idempotent()
  @Roles(...PERIOD_WRITERS)
  @ApiOperation({
    summary: 'Record a stream run',
    description:
      'Requires `Idempotency-Key`. The stream is approved and in force at startTime (422 INVALID_REFERENCE); ' +
      'runs of one stream never overlap (409 STREAM_RUN_OVERLAP); a lot code is made once (409 LOT_CODE_TAKEN).',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async create(
    @Ctx() ctx: RequestContext,
    @Body() body: StreamRunCreateDto,
  ): Promise<StreamRunV2View> {
    return toStreamRunView(await this.runs.create(ctx, body));
  }

  @Patch(':id')
  @Roles(...PERIOD_WRITERS)
  @ApiOperation({
    summary: 'End a stream run or correct its lot / notes',
    description:
      'endTime after startTime (422 INVALID_INTERVAL); the same overlap and lot rules as create.',
  })
  async update(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: StreamRunPatchDto,
  ): Promise<StreamRunV2View> {
    return toStreamRunView(await this.runs.update(ctx, id, body));
  }
}
