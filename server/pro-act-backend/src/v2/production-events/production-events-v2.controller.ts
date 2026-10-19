import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  ParseUUIDPipe,
  Query,
  Res,
  StreamableFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { ScopeParam } from '../../auth/decorators/scope-param.decorator';
import { IfMatch } from '../../common/concurrency/revision';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { EVENT_WRITERS } from './event-write-roles';
import { ETagInterceptor } from '../../common/concurrency/etag.interceptor';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { ProductionEventExportQueryDto } from './production-event-export-query.dto';
import { ProductionEventListQueryDto } from './production-event-list-query.dto';
import { ProductionEventV2View } from './production-event-v2.view';
import { EventSelectionView } from './production-event-selection';
import { ProductionEventsV2Service } from './production-events-v2.service';
import { ProductionEventsV2CommandService } from './production-events-v2-commands.service';
import { ProductionEventHistoryService } from './production-event-history.service';
import { ProductionEventHistoryView } from './production-event-history.view';
import {
  CreateProductionEventV2Dto,
  PatchProductionEventV2Dto,
} from './production-event-v2-write.dto';

@ApiTags('v2 · Production Events')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'production-events', version: '2' })
export class ProductionEventsV2Controller {
  constructor(
    private readonly service: ProductionEventsV2Service,
    private readonly commands: ProductionEventsV2CommandService,
    private readonly history: ProductionEventHistoryService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List production events of the caller tenant',
    description:
      'Filters AND across parameters and OR within a repeated parameter; from/to is a half-open window with ' +
      'overlap semantics; pages are keyset-based on (sort key, id) — sort startTime or durationSeconds, where an event ' +
      'without an end sorts as the longest. The tenant comes from the identity.',
  })
  @ApiHeader({
    name: 'X-Tenant-Id',
    required: false,
    description:
      'Act on another tenant the caller is a member of (SuperAdmin: any tenant)',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: ProductionEventListQueryDto,
  ): Promise<ListResponse<ProductionEventV2View>> {
    return this.service.list(ctx, query);
  }

  // declared before ':id' so `export` is never taken for an event id
  @Get('export')
  @ApiProduces('text/csv')
  @ApiOperation({
    summary: 'Export the filtered production events as CSV (newest first)',
    description:
      'Same filters as the list; from and to are required (≤ 400 days, 422 INVALID_RANGE / WINDOW_TOO_LARGE). ' +
      'At most 50,000 rows (422 EXPORT_TOO_LARGE). Columns: start_utc, end_utc, duration_seconds, unit, asset, ' +
      'event_type, physical_type, schedule_class, oee_component, reason_code, reason, physical_state, ' +
      'coding_state, rca_state, severity, source_kind, description, quantity, quantity_uom, cost; then the plant ' +
      'clock (start_plant, end_plant, ISO 8601 with offset) and the screen labels (event_type_label, ' +
      'physical_type_label, schedule_class_label, oee_component_label, physical_state_label, ' +
      'coding_state_label, rca_state_label, source_kind_label). UTF-8 with a byte order mark.',
  })
  async exportCsv(
    @Ctx() ctx: RequestContext,
    @Query() query: ProductionEventExportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const csv = await this.service.exportCsv(ctx, query);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(csv.content, {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${csv.filename}"`,
      length: csv.content.length,
    });
  }

  @Get('selection')
  @ApiOperation({
    summary:
      'The events matching the filters as a versioned snapshot, for an explicit "all matching" bulk action (SME D13)',
    description:
      'Same filters as the list; from and to are required (≤ 400 days, 422 INVALID_RANGE / WINDOW_TOO_LARGE). ' +
      'Returns the count, first start, last end, units and number of assets, and every event with its row version; ' +
      'bulk coding sends those versions, so an event changed since is refused. More than 10,000 matches is 422 ' +
      'SELECTION_TOO_LARGE.',
  })
  selection(
    @Ctx() ctx: RequestContext,
    @Query() query: ProductionEventExportQueryDto,
  ): Promise<EventSelectionView> {
    return this.service.selection(ctx, query);
  }

  @Get(':id')
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: 'Get one production event of the caller scope',
    description:
      'Returns `ETag: "<rowVersion>"`; a foreign or unknown id is 404. The body is the effective event plus ' +
      '`sourceFacts` (what the source last delivered), `overriddenFields` (user overrides of source values) and ' +
      '`sourceOwnedFields` (fields the source system owns: the interval of a non-manual event and the fields whose ' +
      'edit is recorded as a source override).',
  })
  get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ProductionEventV2View> {
    return this.service.get(ctx, id);
  }

  @Get(':id/revisions')
  @ApiOperation({
    summary: 'Revision history of a production event (ING06)',
    description:
      'Immutable revisions (source, user, system, retraction) with effective snapshots, coding revisions ' +
      'with override provenance, and review items, oldest first. A foreign or unknown id is 404.',
  })
  revisions(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ProductionEventHistoryView> {
    return this.history.history(ctx, id);
  }

  @Post()
  @Roles(...EVENT_WRITERS)
  @Idempotent()
  @ScopeParam('unitId', 'body')
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: 'Create a manual production event (DT08)',
    description:
      'Requires `Idempotency-Key`. Give `endTime` or `durationSeconds` (both must agree within 1 s), or ' +
      'neither for an open event. Classifications default from `eventType`. 422 on interval violations.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiResponse({
    status: 201,
    description: 'Created; `ETag` carries the revision',
  })
  async create(
    @Ctx() ctx: RequestContext,
    @Body() body: CreateProductionEventV2Dto,
  ): Promise<ProductionEventV2View> {
    const id = await this.commands.create(ctx, body);
    return this.service.get(ctx, id);
  }

  @Patch(':id')
  @Roles(...EVENT_WRITERS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: 'Edit user fields of a production event',
    description:
      'Requires `If-Match: "<rowVersion>"` (428 without, 412 when stale). Interval fields are editable on ' +
      'manual events only (409 SOURCE_OWNED).',
  })
  @ApiHeader({ name: 'If-Match', required: true })
  async patch(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @IfMatch() expectedRevision: number,
    @Body() body: PatchProductionEventV2Dto,
  ): Promise<ProductionEventV2View> {
    await this.commands.patch(ctx, id, expectedRevision, body);
    return this.service.get(ctx, id);
  }
}
