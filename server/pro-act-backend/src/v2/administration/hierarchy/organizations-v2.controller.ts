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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { Ctx } from '../../../common/context/ctx.decorator';
import { RequestContext } from '../../../common/context/request-context';
import { Idempotent } from '../../../common/idempotency/idempotent.decorator';
import { ListResponse } from '../../common/response';
import { TenantQueryParamGuard } from '../../common/tenant-query-param.guard';
import {
  CreateOrganizationV2Dto,
  HierarchyListQueryDto,
} from './hierarchy-v2.dto';
import { OrganizationV2View } from './hierarchy-v2.view';
import { HierarchyV2Service } from './hierarchy-v2.service';

/** Organizations of the caller's reach; creating and deleting them is for super administrators. */
@ApiTags('v2 · Organizations')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'organizations', version: '2' })
export class OrganizationsV2Controller {
  constructor(private readonly hierarchy: HierarchyV2Service) {}

  @Get()
  @ApiOperation({ summary: 'Organizations you may see, by name (keyset)' })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: HierarchyListQueryDto,
  ): Promise<ListResponse<OrganizationV2View>> {
    return this.hierarchy.listOrganizations(ctx, query);
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
