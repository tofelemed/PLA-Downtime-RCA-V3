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
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { IngestionExceptionsService } from '../../intake/exceptions/ingestion-exceptions.service';
import { JobAccepted, ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import {
  IngestionExceptionListQueryDto,
  ResolveIngestionExceptionV2Dto,
} from './ingestion-exception-v2.dto';
import { IntakeQueriesV2Service } from './intake-queries-v2.service';
import { REPLAY_ROLES } from './intake-roles';
import {
  IngestionExceptionDetailV2View,
  IngestionExceptionV2View,
  toExceptionView,
} from './intake-v2.view';

/** Quarantine of the durable intake (plan 1.5, spec ING05, §15.2 `/ingestion-exceptions`). */
@ApiTags('v2 · Ingestion Exceptions')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'ingestion-exceptions', version: '2' })
export class IngestionExceptionsV2Controller {
  constructor(
    private readonly queries: IntakeQueriesV2Service,
    private readonly exceptions: IngestionExceptionsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List quarantined deliveries of the caller tenant',
    description:
      'Filters: state, errorCode, connectionId, sourceObjectId. Keyset pages, newest lastSeen first by default.',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: IngestionExceptionListQueryDto,
  ): Promise<ListResponse<IngestionExceptionV2View>> {
    return this.queries.listExceptions(ctx, query);
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'One exception with the retained raw delivery (preview before replay); foreign ids are 404',
  })
  get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<IngestionExceptionDetailV2View> {
    return this.queries.exception(ctx, id);
  }

  @Post(':id/resolve')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @Roles(...REPLAY_ROLES)
  @ApiOperation({
    summary: 'Resolve an open exception: replay (202) or irrecoverable (200)',
    description:
      'Requires `Idempotency-Key`. `replay` queues a replay run for the exception source object (fix the ' +
      'mapping first; the run resolves the exception once the object normalises). `irrecoverable` closes ' +
      'it without data. 409 EXCEPTION_NOT_OPEN when already resolved.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiResponse({ status: 200, description: 'Closed as irrecoverable' })
  @ApiResponse({
    status: 202,
    description: 'Replay run accepted (`GET /replay-runs/{id}`)',
  })
  async resolve(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ResolveIngestionExceptionV2Dto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<IngestionExceptionV2View | JobAccepted> {
    const outcome = await this.exceptions.resolve(ctx, id, body);
    if (outcome.kind === 'irrecoverable')
      return toExceptionView(outcome.exception);
    response.status(HttpStatus.ACCEPTED);
    return {
      jobId: outcome.run.id,
      statusUrl: `/api/v2/replay-runs/${outcome.run.id}`,
    };
  }
}
