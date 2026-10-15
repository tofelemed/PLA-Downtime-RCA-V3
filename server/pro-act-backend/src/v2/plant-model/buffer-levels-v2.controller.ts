import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
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
import { BufferLevelsService } from '../../plant-model/buffer-levels.service';
import { ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { PERIOD_WRITERS } from '../periods/period-roles';
import {
  BufferLevelCreateDto,
  BufferLevelListQueryDto,
} from './plant-flow-v2.dto';
import { BufferLevelV2View, toBufferLevelView } from './plant-flow-v2.view';
import { PlantFlowV2Service } from './plant-flow-v2.service';

/**
 * Recorded buffer (silo) levels (SME E2): an upstream stop starting within 24 h of a reading uses the
 * level above the route's lowest operating level as its cover instead of the configured inventory.
 */
@ApiTags('v2 · Profiles')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'buffer-levels', version: '2' })
export class BufferLevelsV2Controller {
  constructor(
    private readonly lists: PlantFlowV2Service,
    private readonly levels: BufferLevelsService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'List recorded buffer levels (keyset on observedAt, id, newest first)',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: BufferLevelListQueryDto,
  ): Promise<ListResponse<BufferLevelV2View>> {
    return this.lists.listLevels(ctx, query);
  }

  @Post()
  @Idempotent()
  @Roles(...PERIOD_WRITERS)
  @ApiOperation({
    summary: 'Record a buffer level',
    description:
      'Requires `Idempotency-Key`. An approved route from → to in force at observedAt (422 INVALID_REFERENCE), ' +
      "in the route's inventory unit (422 UOM_MISMATCH); one reading per buffer and instant (409 LEVEL_EXISTS).",
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async create(
    @Ctx() ctx: RequestContext,
    @Body() body: BufferLevelCreateDto,
  ): Promise<BufferLevelV2View> {
    return toBufferLevelView(await this.levels.record(ctx, body));
  }
}
