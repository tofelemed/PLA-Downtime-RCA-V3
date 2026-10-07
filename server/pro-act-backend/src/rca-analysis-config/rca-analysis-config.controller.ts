import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { RCAAnalysisConfigService } from './rca-analysis-config.service';
import { CreateRCAAnalysisConfigDto } from './dto/create-rca-analysis-config.dto';
import { UpdateRCAAnalysisConfigDto } from './dto/update-rca-analysis-config.dto';
import { RCAAnalysisConfig } from './rca-analysis-config.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('RCA Analysis Configs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rca-analysis-configs')
export class RCAAnalysisConfigController {
  constructor(private readonly rcaAnalysisConfigService: RCAAnalysisConfigService) {}

  @Post()
  @ApiOperation({ summary: 'Create RCA analysis configuration' })
  @ApiResponse({ status: 201, description: 'Configuration created successfully', type: RCAAnalysisConfig })
  create(@Body() createDto: CreateRCAAnalysisConfigDto): Promise<RCAAnalysisConfig> {
    return this.rcaAnalysisConfigService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all RCA analysis configurations' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'organizationId', required: false })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Return all configurations', type: [RCAAnalysisConfig] })
  findAll(
    @Query('tenantId') tenantId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('isActive') isActive?: string,
  ): Promise<RCAAnalysisConfig[]> {
    const normalizedIsActive =
      isActive === undefined ? undefined : String(isActive).toLowerCase() === 'true';
    return this.rcaAnalysisConfigService.findAll({ tenantId, organizationId, isActive: normalizedIsActive });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get RCA analysis configuration by ID' })
  @ApiResponse({ status: 200, description: 'Return configuration', type: RCAAnalysisConfig })
  findOne(@Param('id') id: string): Promise<RCAAnalysisConfig> {
    return this.rcaAnalysisConfigService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update RCA analysis configuration' })
  @ApiResponse({ status: 200, description: 'Configuration updated successfully', type: RCAAnalysisConfig })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateRCAAnalysisConfigDto,
  ): Promise<RCAAnalysisConfig> {
    return this.rcaAnalysisConfigService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete RCA analysis configuration' })
  @ApiResponse({ status: 204, description: 'Configuration deleted successfully' })
  remove(@Param('id') id: string): Promise<void> {
    return this.rcaAnalysisConfigService.remove(id);
  }
}

