import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { TenantService } from './tenant.service';
import { Tenant } from './tenant.entity';
import { ApiBody, ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { UpdateTenantDisplaySettingsDto } from './dto/update-tenant-display-settings.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { assertOrganizationWritable } from '../auth/roles/org-access';
import { Ctx } from '../common/context/ctx.decorator';
import { RequestContext } from '../common/context/request-context';
import { SkipAudit } from '../audit-log/skip-audit.decorator';

/**
 * Plant settings the v1 update no longer writes: the time zone has a lock and a default-site sync
 * (`PATCH /v2/tenants/:id`), calendar and digits are audited display settings (`PATCH /v2/tenants/:id/display-settings`).
 */
const V2_ONLY_FIELDS = ['timezone', 'calendarSystem', 'digits'] as const;

function refuseV2OnlyFields(data: UpdateTenantDto): void {
  const fields = V2_ONLY_FIELDS.filter((field) => data[field] !== undefined);
  if (!fields.length) return;
  throw new UnprocessableEntityException({
    code: 'PLANT_SETTING_V2_ONLY',
    message: `Change ${fields.join(', ')} in Plant settings (v2), not through this route`,
    details: { fields },
  });
}

/**
 * Reads list what the caller may see (SuperAdmin all, OrgAdmin its organization, everyone else the
 * tenants they are a member of); writes are for SuperAdmin or an OrgAdmin of the tenant's organization.
 */
@ApiTags('Tenants')
@ApiBearerAuth()
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
  @ApiResponse({
    status: 422,
    description:
      'PLANT_SETTING_V2_ONLY: timezone, calendarSystem and digits change only through the v2 plant routes',
  })
  async update(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() data: UpdateTenantDto,
  ): Promise<Tenant | null> {
    refuseV2OnlyFields(data);
    await this.writable(ctx, id);
    if (data.organizationId)
      assertOrganizationWritable(ctx, data.organizationId);
    return this.tenantService.update(id, data);
  }

  /** No `@Roles`: who may write is the tenant-setting rule, checked in the service (which audits the change). */
  @Put(':id/display-settings')
  @SkipAudit()
  @ApiBody({ type: UpdateTenantDisplaySettingsDto })
  @ApiResponse({
    status: 200,
    description: 'Calendar and digit display of the tenant updated',
    type: Tenant,
  })
  @ApiResponse({ status: 403, description: 'FORBIDDEN_ROLE' })
  @ApiResponse({ status: 404, description: 'NOT_FOUND (tenant not visible)' })
  updateDisplaySettings(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() data: UpdateTenantDisplaySettingsDto,
  ): Promise<Tenant> {
    return this.tenantService.updateDisplaySettings(ctx, id, data);
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
