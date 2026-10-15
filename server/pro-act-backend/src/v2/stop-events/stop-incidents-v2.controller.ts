import {
  Body,
  Controller,
  Delete,
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
import { Ctx } from '../../common/context/ctx.decorator';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { listResponse, ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import {
  NewFailureMarkDto,
  StopIncidentListQueryDto,
} from './stop-events-v2.dto';
import { StopIncidentV2View } from './stop-events-v2.view';
import { StopIncidentsV2Service } from './stop-incidents-v2.service';

/** SME D5 repeat-stop incidents: grouping, the incident of an event, and "new failure" marks. */
@ApiTags('v2 · Stop events')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'stop-incidents', version: '2' })
export class StopIncidentsV2Controller {
  constructor(private readonly service: StopIncidentsV2Service) {}

  @Get()
  @ApiOperation({
    summary:
      'Repeat-stop incidents of a unit overlapping the window (newest first; keyset)',
    description:
      'Stops of one asset and reason starting within the incident window after the previous one ended. Every ' +
      'stop stays its own event with its own duration (`stoppedSeconds` sums the stops, never the envelope); ' +
      'MTBF counts the incident once (KPI 2.7.8).',
  })
  async list(
    @Ctx() ctx: RequestContext,
    @Query() query: StopIncidentListQueryDto,
  ): Promise<ListResponse<StopIncidentV2View>> {
    const page = await this.service.list(ctx, query);
    return listResponse(page.items, page.nextCursor, {
      tenantId: requireTenantId(ctx),
      unitIds: [query.unitId],
    });
  }

  @Get('by-event/:eventId')
  @ApiOperation({
    summary:
      'The incident of an event’s stop occurrence (null = not a repeat stop)',
    description: '404 for an event outside the caller’s scope.',
  })
  forEvent(
    @Ctx() ctx: RequestContext,
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
  ): Promise<StopIncidentV2View | null> {
    return this.service.forEvent(ctx, eventId);
  }

  @Post('new-failure-marks')
  @Idempotent()
  @ApiOperation({
    summary: 'Mark a stop as a new failure (function restored before it)',
    description:
      'Requires `Idempotency-Key`. SME D5: a verified repair before this stop; the grouping never joins it to ' +
      'the stop before it. Regroups the unit at once. 404 for an occurrence outside the caller’s scope.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async mark(
    @Ctx() ctx: RequestContext,
    @Body() body: NewFailureMarkDto,
  ): Promise<{ occurrenceId: string; reason: string; createdAt: string }> {
    const mark = await this.service.markNewFailure(
      ctx,
      body.occurrenceId,
      body.reason,
    );
    return {
      occurrenceId: mark.occurrenceId,
      reason: mark.reason,
      createdAt: new Date(mark.createdAt).toISOString(),
    };
  }

  @Delete('new-failure-marks/:occurrenceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Remove a "new failure" mark (the grouping may join the stop again)',
  })
  clear(
    @Ctx() ctx: RequestContext,
    @Param('occurrenceId', new ParseUUIDPipe()) occurrenceId: string,
  ): Promise<void> {
    return this.service.clearNewFailure(ctx, occurrenceId);
  }
}
