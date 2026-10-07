import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PIMappingService } from './pi-mapping.service';
import { CreatePIMappingDto } from './dto/create-pi-mapping.dto';
import { UpdatePIMappingDto } from './dto/update-pi-mapping.dto';
import { PIMapping } from './pi-mapping.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('PI Mappings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pi-mappings')
export class PIMappingController {
  constructor(private readonly piMappingService: PIMappingService) {}

  @Post()
  @ApiOperation({ summary: 'Create PI mapping' })
  @ApiResponse({ status: 201, description: 'Mapping created successfully', type: PIMapping })
  create(@Body() createDto: CreatePIMappingDto): Promise<PIMapping> {
    return this.piMappingService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all PI mappings' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'organizationId', required: false })
  @ApiQuery({ name: 'sourceType', required: false })
  @ApiQuery({ name: 'targetType', required: false })
  @ApiResponse({ status: 200, description: 'Return all mappings', type: [PIMapping] })
  findAll(
    @Query('tenantId') tenantId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('sourceType') sourceType?: string,
    @Query('targetType') targetType?: string,
  ): Promise<PIMapping[]> {
    return this.piMappingService.findAll({ tenantId, organizationId, sourceType, targetType });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get PI mapping by ID' })
  @ApiResponse({ status: 200, description: 'Return mapping', type: PIMapping })
  findOne(@Param('id') id: string): Promise<PIMapping> {
    return this.piMappingService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update PI mapping' })
  @ApiResponse({ status: 200, description: 'Mapping updated successfully', type: PIMapping })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdatePIMappingDto,
  ): Promise<PIMapping> {
    return this.piMappingService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete PI mapping' })
  @ApiResponse({ status: 204, description: 'Mapping deleted successfully' })
  remove(@Param('id') id: string): Promise<void> {
    return this.piMappingService.remove(id);
  }
}

