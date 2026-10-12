import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DashboardConfigurationService } from './dashboard-configuration.service';
import { DashboardConfigApiPayload, DashboardConfigApiRecord } from './dashboard-configuration.mapper';
import { findOrThrow } from '../common/helpers/find-or-throw';

@ApiTags('Dashboard Configurations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard-configurations')
export class DashboardConfigurationController {
  constructor(private readonly configService: DashboardConfigurationService) {}

  @Get()
  findAll(
    @Query('tenantId') tenantId?: string,
    @Query('active') active?: string,
    @Query('version') version?: string,
  ): Promise<DashboardConfigApiRecord[]> {
    if (active === 'true' && tenantId) {
      return this.configService.findActiveByTenant(tenantId).then((config) => (config ? [config] : []));
    }
    if (version && tenantId) {
      return this.configService.findByVersion(tenantId, parseInt(version, 10)).then((config) => (config ? [config] : []));
    }
    if (tenantId) {
      return this.configService.findByTenant(tenantId);
    }
    return this.configService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<DashboardConfigApiRecord> {
    return findOrThrow(this.configService.findOne(id), 'DashboardConfiguration', id);
  }

  @Post()
  async create(@Body() data: DashboardConfigApiPayload): Promise<DashboardConfigApiRecord> {
    if (data.isActive && data.tenantId) {
      await this.configService.deactivateAll(data.tenantId);
    }
    return this.configService.create(data);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() data: DashboardConfigApiPayload,
  ): Promise<DashboardConfigApiRecord | null> {
    if (data.isActive && data.tenantId) {
      await this.configService.deactivateAll(data.tenantId);
    }
    return this.configService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.configService.remove(id);
  }
}
