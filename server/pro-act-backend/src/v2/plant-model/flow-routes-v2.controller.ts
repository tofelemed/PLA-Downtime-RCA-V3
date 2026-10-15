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
import { PlantFlowRoutesService } from '../../plant-model/plant-flow-routes.service';
import { ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { PROFILE_APPROVERS, PROFILE_WRITERS } from '../profiles/profile-roles';
import { APPROVE_DESCRIPTION, ApproveDto } from '../profiles/profile-v2.dto';
import { FlowRouteCreateDto, FlowRouteListQueryDto } from './plant-flow-v2.dto';
import { FlowRouteV2View, toFlowRouteView } from './plant-flow-v2.view';
import { PlantFlowV2Service } from './plant-flow-v2.service';

/**
 * The plant's material-flow map (SME E2): routes between units with their buffers, maker-checker
 * master data like rates. An upstream stop consumes the buffer's cover before it starves the downstream
 * unit; the starved time is charged to the upstream stop.
 */
@ApiTags('v2 · Profiles')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'flow-routes', version: '2' })
export class FlowRoutesV2Controller {
  constructor(
    private readonly lists: PlantFlowV2Service,
    private readonly routes: PlantFlowRoutesService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'List flow route versions touching a unit (keyset on effectiveFrom, id)',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: FlowRouteListQueryDto,
  ): Promise<ListResponse<FlowRouteV2View>> {
    return this.lists.listRoutes(ctx, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one flow route version; foreign ids are 404' })
  async get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<FlowRouteV2View> {
    return toFlowRouteView(await this.routes.get(ctx, id));
  }

  @Post()
  @Idempotent()
  @Roles(...PROFILE_WRITERS)
  @ApiOperation({
    summary: 'Create a draft flow route version',
    description:
      'Requires `Idempotency-Key`. Both units of the tenant in scope (422 INVALID_REFERENCE), different (422 SAME_UNIT); ' +
      'a buffer needs inventoryUom and drawRatePerHour > 0 (422 BUFFER_INCOMPLETE); max above min level (422 INVALID_LIMITS).',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async create(
    @Ctx() ctx: RequestContext,
    @Body() body: FlowRouteCreateDto,
  ): Promise<FlowRouteV2View> {
    return toFlowRouteView(await this.routes.create(ctx, body));
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...PROFILE_APPROVERS)
  @ApiOperation({
    summary: 'Approve a draft flow route version',
    description: `${APPROVE_DESCRIPTION} 422 FLOW_CYCLE when an approved path leads back from its to-unit to its from-unit.`,
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async approve(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ApproveDto,
  ): Promise<FlowRouteV2View> {
    return toFlowRouteView(
      await this.routes.approve(ctx, id, body.supersede ?? false),
    );
  }

  @Post(':id/retire')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...PROFILE_APPROVERS)
  @ApiOperation({ summary: 'Retire a flow route version (draft or approved)' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async retire(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<FlowRouteV2View> {
    return toFlowRouteView(await this.routes.retire(ctx, id));
  }
}
