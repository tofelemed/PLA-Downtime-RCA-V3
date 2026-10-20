import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  NotFoundException,
} from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { Organization } from './organization.entity';
import { ApiBody, ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { assertOrganizationWritable } from '../auth/roles/org-access';
import { Ctx } from '../common/context/ctx.decorator';
import { RequestContext } from '../common/context/request-context';
import { findOrThrow } from '../common/helpers/find-or-throw';

/**
 * Reads list what the caller may see (SuperAdmin all, everyone else their own organization and the
 * organizations of their member tenants); creating one is a SuperAdmin operation, changing or
 * deleting one is for SuperAdmin or that organization's OrgAdmin.
 */
@ApiTags('Organizations')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get()
  @ApiResponse({
    status: 200,
    description: 'Organizations visible to the caller',
    type: [Organization],
  })
  findAll(@Ctx() ctx: RequestContext): Promise<Organization[]> {
    return this.organizationService.findVisible(ctx);
  }

  @Get(':id')
  @ApiResponse({
    status: 200,
    description: 'Get organization by ID',
    type: Organization,
  })
  findOne(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
  ): Promise<Organization> {
    return findOrThrow(
      this.organizationService.findOneVisible(ctx, id),
      'Organization',
      id,
    );
  }

  @Post()
  @Roles('SuperAdmin')
  @ApiBody({ type: CreateOrganizationDto })
  @ApiResponse({
    status: 201,
    description: 'Create organization',
    type: Organization,
  })
  create(@Body() data: CreateOrganizationDto): Promise<Organization> {
    return this.organizationService.create(data);
  }

  @Put(':id')
  @Roles('SuperAdmin', 'OrgAdmin')
  @ApiBody({ type: UpdateOrganizationDto })
  @ApiResponse({
    status: 200,
    description: 'Update organization',
    type: Organization,
  })
  async update(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() data: UpdateOrganizationDto,
  ): Promise<Organization | null> {
    await this.writable(ctx, id);
    return this.organizationService.update(id, data);
  }

  @Delete(':id')
  @Roles('SuperAdmin', 'OrgAdmin')
  @ApiResponse({ status: 200, description: 'Delete organization' })
  async remove(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
  ): Promise<void> {
    await this.writable(ctx, id);
    return this.organizationService.remove(id);
  }

  private async writable(ctx: RequestContext, id: string): Promise<void> {
    const organization = await this.organizationService.findOneVisible(ctx, id);
    if (!organization) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
    }
    assertOrganizationWritable(ctx, organization.id);
  }
}
