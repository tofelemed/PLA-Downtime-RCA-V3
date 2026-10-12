import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
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
import { Response } from 'express';
import { IfMatch } from '../../common/concurrency/revision';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import {
  BulkCodeV2Dto,
  CloseEventV2Dto,
  MergeEventsV2Dto,
  RetractEventV2Dto,
  SplitEventV2Dto,
} from './event-operations-v2.dto';
import { EventOperationView } from './event-operation.view';
import {
  BulkCodeOutcome,
  ProductionEventOperationsV2Service,
} from './production-event-operations-v2.service';

const IDEMPOTENCY_HEADER = { name: 'Idempotency-Key', required: true };
const IF_MATCH_HEADER = {
  name: 'If-Match',
  required: true,
  description: 'ETag of the event as read (428 without, 412 when stale)',
};

/** Event operations (spec DT09–DT11, §15.2 command routes; plan 1.4). */
@ApiTags('v2 · Production Events')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'production-events', version: '2' })
export class ProductionEventOperationsV2Controller {
  constructor(
    private readonly operations: ProductionEventOperationsV2Service,
  ) {}

  @Post('merge')
  @Idempotent()
  @ApiOperation({
    summary: 'Merge adjacent or overlapping events of one unit (DT09)',
    description:
      'Each event carries the `expectedVersion` the caller read (412 STALE_REVISION). One new event spans the ' +
      'union; contributors become superseded with `merged_from` lineage. 422: MERGE_DIFFERENT_UNITS, ' +
      'MERGE_INCOMPATIBLE_CLASSIFICATION, MERGE_GAP_EXCEEDED, MERGE_CODING_CONFLICT (details list the conflicts); ' +
      '409 INVALID_STATE for superseded or retracted events; 404 for foreign or unknown ids.',
  })
  @ApiHeader(IDEMPOTENCY_HEADER)
  @ApiResponse({ status: 201, description: 'Merged' })
  merge(
    @Ctx() ctx: RequestContext,
    @Body() body: MergeEventsV2Dto,
  ): Promise<EventOperationView> {
    return this.operations.merge(ctx, body);
  }

  @Post('bulk-code')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Code many events at once (DT10)',
    description:
      '`preview: true` reports before/after per event, exclusions (not found, superseded, retracted, stale ' +
      'version, duplicate) and affected windows. `preview: false` applies up to 500 events atomically (404/409/' +
      '412/422 when any item is excluded) or, above 500, answers 202 with a job processed in chunks of 200.',
  })
  @ApiHeader(IDEMPOTENCY_HEADER)
  @ApiResponse({ status: 200, description: 'Preview or applied result' })
  @ApiResponse({ status: 202, description: 'Job accepted (`GET /jobs/{id}`)' })
  async bulkCode(
    @Ctx() ctx: RequestContext,
    @Body() body: BulkCodeV2Dto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<BulkCodeOutcome['body']> {
    const outcome = await this.operations.bulkCodeCommand(ctx, body);
    if (outcome.kind === 'job') response.status(HttpStatus.ACCEPTED);
    return outcome.body;
  }

  @Post(':id/split')
  @Idempotent()
  @ApiOperation({
    summary: 'Split an event at an instant (DT09)',
    description:
      'Two children with the parent coding and occurrence; the parent becomes superseded (`split_child_of` ' +
      'lineage). 422 SPLIT_OUTSIDE_INTERVAL; 409 INVALID_STATE for superseded or retracted events.',
  })
  @ApiHeader(IDEMPOTENCY_HEADER)
  @ApiHeader(IF_MATCH_HEADER)
  @ApiResponse({ status: 201, description: 'Split' })
  split(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @IfMatch() expectedVersion: number,
    @Body() body: SplitEventV2Dto,
  ): Promise<EventOperationView> {
    return this.operations.split(ctx, id, expectedVersion, body);
  }

  @Post(':id/close')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Close an open event (DT10)',
    description:
      'Sets the end with a user revision (closing is not approving). On a source-owned event the end is an ' +
      'override until the source delivers the same end (review item resolved automatically). 409 ' +
      'EVENT_NOT_OPEN / INVALID_STATE; 422 CLOSE_END_BEFORE_START / CLOSE_END_IN_FUTURE.',
  })
  @ApiHeader(IDEMPOTENCY_HEADER)
  @ApiHeader(IF_MATCH_HEADER)
  close(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @IfMatch() expectedVersion: number,
    @Body() body: CloseEventV2Dto,
  ): Promise<EventOperationView> {
    return this.operations.close(ctx, id, expectedVersion, body);
  }

  @Post(':id/retract')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Retract a manual event (v2 equivalent of the v1 delete)',
    description:
      'Events are append-only: the event is tombstoned (physical state `retracted`, a `retraction` revision) ' +
      'and its window is recalculated; nothing is deleted. 409 SOURCE_OWNED for events delivered by a ' +
      'connected source (their source retracts them); 409 INVALID_STATE when already superseded or retracted; ' +
      '412 STALE_REVISION; 404 for foreign or unknown ids.',
  })
  @ApiHeader(IDEMPOTENCY_HEADER)
  @ApiHeader(IF_MATCH_HEADER)
  retract(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @IfMatch() expectedVersion: number,
    @Body() body: RetractEventV2Dto,
  ): Promise<EventOperationView> {
    return this.operations.retract(ctx, id, expectedVersion, body);
  }
}
