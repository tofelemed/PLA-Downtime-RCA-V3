import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  ParseUUIDPipe,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ScopeParam } from '../../auth/decorators/scope-param.decorator';
import { IfMatch } from '../../common/concurrency/revision';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { ETagInterceptor } from '../../common/concurrency/etag.interceptor';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { ProductionEventListQueryDto } from './production-event-list-query.dto';
import { ProductionEventV2View } from './production-event-v2.view';
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
      'overlap semantics; pages are keyset-based on (startTime, id). The tenant comes from the identity.',
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

  @Get(':id')
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: 'Get one production event of the caller scope',
    description:
      'Returns `ETag: "<rowVersion>"`; a foreign or unknown id is 404. The body is the effective event plus ' +
      '`sourceFacts` (what the source last delivered) and `overriddenFields` (user overrides of source values).',
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
