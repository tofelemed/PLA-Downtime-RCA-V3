import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { EvidenceLocationService } from './evidence-location.service';
import { EvidenceLocation } from './evidence-location.entity';

@Controller('evidence-locations')
export class EvidenceLocationController {
  constructor(private readonly locationService: EvidenceLocationService) {}

  @Get()
  findAll(@Query('tenantId') tenantId?: string): Promise<EvidenceLocation[]> {
    if (tenantId) {
      return this.locationService.findByTenant(tenantId);
    }
    return this.locationService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<EvidenceLocation | null> {
    return this.locationService.findOne(id);
  }

  @Post()
  create(@Body() data: Partial<EvidenceLocation>): Promise<EvidenceLocation> {
    return this.locationService.create(data);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() data: Partial<EvidenceLocation>): Promise<EvidenceLocation | null> {
    return this.locationService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.locationService.remove(id);
  }
} 