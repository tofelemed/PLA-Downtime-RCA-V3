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
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { ETagInterceptor } from '../../../common/concurrency/etag.interceptor';
import { IfMatch } from '../../../common/concurrency/revision';
import { Ctx } from '../../../common/context/ctx.decorator';
import { RequestContext } from '../../../common/context/request-context';
import { Idempotent } from '../../../common/idempotency/idempotent.decorator';
import { ListResponse } from '../../common/response';
import { TenantQueryParamGuard } from '../../common/tenant-query-param.guard';
import {
  CreatePlantV2Dto,
  PlantDisplaySettingsV2Dto,
  PlantsListQueryDto,
  UpdatePlantV2Dto,
} from './hierarchy-v2.dto';
import { PlantDetailV2View, PlantV2View } from './hierarchy-v2.view';
import { HierarchyEditV2Service } from './hierarchy-edit-v2.service';
import { HierarchyV2Service } from './hierarchy-v2.service';
import { SkipAudit } from '../../../audit-log/skip-audit.decorator';

/** Plants (tenants) of the caller's reach: create, edit (name, description, time zone), display settings. */
@ApiTags('v2 · Plants')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'tenants', version: '2' })
export class PlantsV2Controller {
  constructor(
    private readonly hierarchy: HierarchyV2Service,
    private readonly edits: HierarchyEditV2Service,
  ) {}

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
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: 'One plant you may see (ETag = row version; 404 otherwise)',
    description:
      'For callers who may edit it: `timezoneEditable` (false once the plant has production events, ' +
      'signal samples or calculated periods) and `timezoneLockedReason`.',
  })
  get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<PlantDetailV2View> {
    return this.edits.getPlant(ctx, id);
  }

  @Patch(':id')
  @SkipAudit()
  @Roles('SuperAdmin', 'OrgAdmin')
  @UseInterceptors(ETagInterceptor)
  @ApiHeader({ name: 'If-Match', required: true })
  @ApiOperation({
    summary: 'Rename a plant, change its description or time zone (If-Match)',
    description:
      'Super administrators, or the administrator of the plant’s organization (403 ORGANIZATION_NOT_ALLOWED). ' +
      'Code and organization cannot change: sending them (or any undeclared field) answers 422 VALIDATION_FAILED. ' +
      'The time zone changes only while the plant has no production events, signal samples or calculated ' +
      'periods (409 TIMEZONE_LOCKED with the counts in `details`); 422 INVALID_TIMEZONE. The default site ' +
      'follows the new time zone and name. 428 REVISION_REQUIRED, 412 STALE_REVISION.',
  })
  update(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @IfMatch() expectedVersion: number,
    @Body() body: UpdatePlantV2Dto,
  ): Promise<PlantDetailV2View> {
    return this.edits.updatePlant(ctx, id, expectedVersion, body);
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
  @SkipAudit()
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
