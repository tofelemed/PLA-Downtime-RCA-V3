import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DataSourceService } from './data-source.service';
import { CreateDataSourceDto } from './dto/create-data-source.dto';
import { UpdateDataSourceDto } from './dto/update-data-source.dto';
import { DataSource } from './data-source.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Data Sources')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('data-sources')
export class DataSourceController {
  constructor(private readonly dataSourceService: DataSourceService) {}

  @Post()
  @ApiOperation({ summary: 'Create data source' })
  @ApiResponse({ status: 201, description: 'Source created successfully', type: DataSource })
  create(@Body() createDto: CreateDataSourceDto): Promise<DataSource> {
    return this.dataSourceService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all data sources' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'organizationId', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'enabled', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Return all sources', type: [DataSource] })
  findAll(
    @Query('tenantId') tenantId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('enabled') enabled?: boolean,
  ): Promise<DataSource[]> {
    return this.dataSourceService.findAll({ tenantId, organizationId, type, status, enabled });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get data source by ID' })
  @ApiResponse({ status: 200, description: 'Return source', type: DataSource })
  findOne(@Param('id') id: string): Promise<DataSource> {
    return this.dataSourceService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update data source' })
  @ApiResponse({ status: 200, description: 'Source updated successfully', type: DataSource })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateDataSourceDto,
  ): Promise<DataSource> {
    return this.dataSourceService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete data source' })
  @ApiResponse({ status: 204, description: 'Source deleted successfully' })
  remove(@Param('id') id: string): Promise<void> {
    return this.dataSourceService.remove(id);
  }
}

