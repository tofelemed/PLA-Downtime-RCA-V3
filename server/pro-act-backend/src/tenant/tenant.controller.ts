import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { TenantService } from './tenant.service';
import { Tenant } from './tenant.entity';
import { ApiBody, ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { assertOrganizationWritable } from '../auth/roles/org-access';
import { Ctx } from '../common/context/ctx.decorator';
import { RequestContext } from '../common/context/request-context';

/**
 * Reads list what the caller may see (SuperAdmin all, OrgAdmin its organization, everyone else the
 * tenants they are a member of); writes are for SuperAdmin or an OrgAdmin of the tenant's organization.
 */
@ApiTags('Tenants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get()
  @ApiResponse({
    status: 200,
    description: 'Tenants visible to the caller',
    type: [Tenant],
  })
  findAll(@Ctx() ctx: RequestContext): Promise<Tenant[]> {
    return this.tenantService.findVisible(ctx);
  }

  @Get(':id')
  @ApiResponse({ status: 200, description: 'Get tenant by ID', type: Tenant })
  findOne(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
  ): Promise<Tenant | null> {
    return this.tenantService.findOneVisible(ctx, id);
  }

  @Post()
  @Roles('SuperAdmin', 'OrgAdmin')
  @ApiBody({ type: CreateTenantDto })
  @ApiResponse({ status: 201, description: 'Create tenant', type: Tenant })
  create(
    @Ctx() ctx: RequestContext,
    @Body() data: CreateTenantDto,
  ): Promise<Tenant> {
    assertOrganizationWritable(ctx, data.organizationId);
    return this.tenantService.create(data);
  }

  @Put(':id')
  @Roles('SuperAdmin', 'OrgAdmin')
  @ApiBody({ type: UpdateTenantDto })
  @ApiResponse({ status: 200, description: 'Update tenant', type: Tenant })
  async update(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() data: UpdateTenantDto,
  ): Promise<Tenant | null> {
    await this.writable(ctx, id);
    if (data.organizationId)
      assertOrganizationWritable(ctx, data.organizationId);
    return this.tenantService.update(id, data);
  }

  @Delete(':id')
  @Roles('SuperAdmin', 'OrgAdmin')
  @ApiResponse({ status: 200, description: 'Delete tenant' })
  async remove(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
  ): Promise<void> {
    await this.writable(ctx, id);
    return this.tenantService.remove(id);
  }

  private async writable(ctx: RequestContext, id: string): Promise<Tenant> {
    const tenant = await this.tenantService.findOneVisible(ctx, id);
    if (!tenant) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
    }
    assertOrganizationWritable(ctx, tenant.organizationId);
    return tenant;
  }
}
