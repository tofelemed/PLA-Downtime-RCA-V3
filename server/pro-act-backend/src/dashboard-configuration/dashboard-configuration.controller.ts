import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { DashboardConfigurationService } from './dashboard-configuration.service';
import { DashboardConfiguration } from './dashboard-configuration.entity';

@Controller('dashboard-configurations')
export class DashboardConfigurationController {
  constructor(private readonly configService: DashboardConfigurationService) {}

  @Get()
  findAll(
    @Query('tenantId') tenantId?: string,
    @Query('active') active?: string,
    @Query('version') version?: string,
  ): Promise<DashboardConfiguration[]> {
    if (active === 'true' && tenantId) {
      return this.configService.findActiveByTenant(tenantId).then(config => config ? [config] : []);
    }
    if (version && tenantId) {
      return this.configService.findByVersion(tenantId, parseInt(version)).then(config => config ? [config] : []);
    }
    if (tenantId) {
      return this.configService.findByTenant(tenantId);
    }
    return this.configService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<DashboardConfiguration | null> {
    return this.configService.findOne(id);
  }

  @Post()
  async create(@Body() data: Partial<DashboardConfiguration>): Promise<DashboardConfiguration> {
    // If this is an active configuration, deactivate all others for the tenant
    if (data.isActive && data.tenantId) {
      await this.configService.deactivateAll(data.tenantId);
    }
    return this.configService.create(data);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() data: Partial<DashboardConfiguration>): Promise<DashboardConfiguration | null> {
    // If this is being set as active, deactivate all others for the tenant
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