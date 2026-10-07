import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PISyncWatermarkService } from './pi-sync-watermark.service';
import { CreatePISyncWatermarkDto } from './dto/create-pi-sync-watermark.dto';
import { UpdatePISyncWatermarkDto } from './dto/update-pi-sync-watermark.dto';
import { PISyncWatermark } from './pi-sync-watermark.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('PI Sync Watermarks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pi-sync-watermarks')
export class PISyncWatermarkController {
  constructor(private readonly piSyncWatermarkService: PISyncWatermarkService) {}

  @Post()
  @ApiOperation({ summary: 'Create PI sync watermark' })
  @ApiResponse({ status: 201, description: 'Watermark created successfully', type: PISyncWatermark })
  create(@Body() createDto: CreatePISyncWatermarkDto): Promise<PISyncWatermark> {
    return this.piSyncWatermarkService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all PI sync watermarks' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'organizationId', required: false })
  @ApiQuery({ name: 'syncType', required: false })
  @ApiResponse({ status: 200, description: 'Return all watermarks', type: [PISyncWatermark] })
  findAll(
    @Query('tenantId') tenantId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('syncType') syncType?: string,
  ): Promise<PISyncWatermark[]> {
    return this.piSyncWatermarkService.findAll({ tenantId, organizationId, syncType });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get PI sync watermark by ID' })
  @ApiResponse({ status: 200, description: 'Return watermark', type: PISyncWatermark })
  findOne(@Param('id') id: string): Promise<PISyncWatermark> {
    return this.piSyncWatermarkService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update PI sync watermark' })
  @ApiResponse({ status: 200, description: 'Watermark updated successfully', type: PISyncWatermark })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdatePISyncWatermarkDto,
  ): Promise<PISyncWatermark> {
    return this.piSyncWatermarkService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete PI sync watermark' })
  @ApiResponse({ status: 204, description: 'Watermark deleted successfully' })
  remove(@Param('id') id: string): Promise<void> {
    return this.piSyncWatermarkService.remove(id);
  }
}

