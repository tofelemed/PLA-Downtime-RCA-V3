import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { Ctx } from '../../../common/context/ctx.decorator';
import { RequestContext } from '../../../common/context/request-context';
import { Idempotent } from '../../../common/idempotency/idempotent.decorator';
import { ListResponse } from '../../common/response';
import { TenantQueryParamGuard } from '../../common/tenant-query-param.guard';
import {
  CreatePlantV2Dto,
  PlantDisplaySettingsV2Dto,
  PlantsListQueryDto,
} from './hierarchy-v2.dto';
import { PlantV2View } from './hierarchy-v2.view';
import { HierarchyV2Service } from './hierarchy-v2.service';

/** Plants (tenants) of the caller's reach, and their display settings. */
@ApiTags('v2 · Plants')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'tenants', version: '2' })
export class PlantsV2Controller {
  constructor(private readonly hierarchy: HierarchyV2Service) {}

  @Get()
  @ApiOperation({
    summary: 'Plants you may see, by name (keyset)',
    description:
      'Super administrators: all; organization administrators: their organization’s; others: their plants.',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: PlantsListQueryDto,
  ): Promise<ListResponse<PlantV2View>> {
    return this.hierarchy.listPlants(ctx, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One plant you may see (404 otherwise)' })
  get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<PlantV2View> {
    return this.hierarchy.getPlant(ctx, id);
  }

  @Post()
  @Roles('SuperAdmin', 'OrgAdmin')
  @Idempotent()
  @ApiOperation({
    summary: 'Create a plant in an organization (requires Idempotency-Key)',
    description:
      'Super administrators, or the organization’s administrator (403 ORGANIZATION_NOT_ALLOWED); ' +
      '422 INVALID_TIMEZONE, 409 CODE_EXISTS.',
  })
  create(
    @Ctx() ctx: RequestContext,
    @Body() body: CreatePlantV2Dto,
  ): Promise<PlantV2View> {
    return this.hierarchy.createPlant(ctx, body);
  }

  @Patch(':id/display-settings')
  @ApiOperation({
    summary: 'Calendar system and digits of a plant',
    description:
      'Super administrators, or a plant administrator / manager approver acting in the plant (403 FORBIDDEN_ROLE).',
  })
  updateDisplaySettings(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: PlantDisplaySettingsV2Dto,
  ): Promise<PlantV2View> {
    return this.hierarchy.updateDisplaySettings(ctx, id, body);
  }

  @Delete(':id')
  @Roles('SuperAdmin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete an empty plant',
    description:
      '409 PLANT_IN_USE while it has units or users; 422 PLANT_IN_USE for the plant you act in.',
  })
  remove(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.hierarchy.deletePlant(ctx, id);
  }
}
