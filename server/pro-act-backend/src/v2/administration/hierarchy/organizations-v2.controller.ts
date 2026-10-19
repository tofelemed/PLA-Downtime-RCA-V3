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
  CreateOrganizationV2Dto,
  HierarchyListQueryDto,
  UpdateOrganizationV2Dto,
} from './hierarchy-v2.dto';
import { HierarchyEditV2Service } from './hierarchy-edit-v2.service';
import { OrganizationV2View } from './hierarchy-v2.view';
import { HierarchyV2Service } from './hierarchy-v2.service';

/**
 * Organizations of the caller's reach; creating and deleting them is for super administrators, editing
 * name and description also for the organization's administrator.
 */
@ApiTags('v2 · Organizations')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'organizations', version: '2' })
export class OrganizationsV2Controller {
  constructor(
    private readonly hierarchy: HierarchyV2Service,
    private readonly edits: HierarchyEditV2Service,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Organizations you may see, by name (keyset)' })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: HierarchyListQueryDto,
  ): Promise<ListResponse<OrganizationV2View>> {
    return this.hierarchy.listOrganizations(ctx, query);
  }

  @Get(':id')
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: 'One organization you may see (ETag = row version; 404 otherwise)',
  })
  get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<OrganizationV2View> {
    return this.edits.getOrganization(ctx, id);
  }

  @Patch(':id')
  @Roles('SuperAdmin', 'OrgAdmin')
  @UseInterceptors(ETagInterceptor)
  @ApiHeader({ name: 'If-Match', required: true })
  @ApiOperation({
    summary: 'Rename an organization or change its description (If-Match)',
    description:
      'Super administrators, or the organization’s administrator (403 ORGANIZATION_NOT_ALLOWED). ' +
      'The code cannot change: sending `code` (or any undeclared field) answers 422 VALIDATION_FAILED. ' +
      '428 REVISION_REQUIRED without If-Match, 412 STALE_REVISION when it changed since it was read.',
  })
  update(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @IfMatch() expectedVersion: number,
    @Body() body: UpdateOrganizationV2Dto,
  ): Promise<OrganizationV2View> {
    return this.edits.updateOrganization(ctx, id, expectedVersion, body);
  }

  @Post()
  @Roles('SuperAdmin')
  @Idempotent()
  @ApiOperation({
    summary:
      'Create an organization (requires Idempotency-Key); 409 CODE_EXISTS',
  })
  create(
    @Ctx() ctx: RequestContext,
    @Body() body: CreateOrganizationV2Dto,
  ): Promise<OrganizationV2View> {
    return this.hierarchy.createOrganization(ctx, body);
  }

  @Delete(':id')
  @Roles('SuperAdmin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Delete an organization without plants (409 ORGANIZATION_HAS_PLANTS)',
  })
  remove(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.hierarchy.deleteOrganization(ctx, id);
  }
}
