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
import { UnitStreamsService } from '../../plant-model/unit-streams.service';
import { ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { PROFILE_APPROVERS, PROFILE_WRITERS } from '../profiles/profile-roles';
import { APPROVE_DESCRIPTION, ApproveDto } from '../profiles/profile-v2.dto';
import {
  UnitStreamCreateDto,
  UnitStreamListQueryDto,
} from './unit-stream-v2.dto';
import { toUnitStreamView, UnitStreamV2View } from './unit-stream-v2.view';
import { UnitStreamsV2Service } from './unit-streams-v2.service';

/**
 * Streams of a unit (SME E6 / LA-10): parallel trains or lines with their share of the unit's rate,
 * maker-checker master data like rates. The accounting engine gives each product slice the capacity of
 * the stream time it ran, so concurrent products never count the unit twice.
 */
@ApiTags('v2 · Profiles')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'unit-streams', version: '2' })
export class UnitStreamsV2Controller {
  constructor(
    private readonly lists: UnitStreamsV2Service,
    private readonly streams: UnitStreamsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List unit stream versions (keyset on effectiveFrom, id)',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: UnitStreamListQueryDto,
  ): Promise<ListResponse<UnitStreamV2View>> {
    return this.lists.listStreams(ctx, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one unit stream version; foreign ids are 404' })
  async get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<UnitStreamV2View> {
    return toUnitStreamView(await this.streams.get(ctx, id));
  }

  @Post()
  @Idempotent()
  @Roles(...PROFILE_WRITERS)
  @ApiOperation({
    summary: 'Create a draft unit stream version',
    description:
      'Requires `Idempotency-Key`. Unit of the tenant in scope (422 INVALID_REFERENCE); capacityShare in (0, 1] ' +
      '(422 INVALID_CAPACITY_SHARE).',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async create(
    @Ctx() ctx: RequestContext,
    @Body() body: UnitStreamCreateDto,
  ): Promise<UnitStreamV2View> {
    return toUnitStreamView(await this.streams.create(ctx, body));
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...PROFILE_APPROVERS)
  @ApiOperation({
    summary: 'Approve a draft unit stream version',
    description: `${APPROVE_DESCRIPTION} 409 STREAM_SHARE_EXCEEDED when the unit's approved streams would provide more than its whole rate.`,
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async approve(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ApproveDto,
  ): Promise<UnitStreamV2View> {
    return toUnitStreamView(
      await this.streams.approve(ctx, id, body.supersede ?? false),
    );
  }

  @Post(':id/retire')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...PROFILE_APPROVERS)
  @ApiOperation({ summary: 'Retire a unit stream version (draft or approved)' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async retire(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<UnitStreamV2View> {
    return toUnitStreamView(await this.streams.retire(ctx, id));
  }
}
