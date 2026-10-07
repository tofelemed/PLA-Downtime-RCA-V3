import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { FMEAAnalysisService } from './fmea-analysis.service';
import { CreateFMEAAnalysisDto } from './dto/create-fmea-analysis.dto';
import { UpdateFMEAAnalysisDto } from './dto/update-fmea-analysis.dto';
import { FMEAAnalysis } from './fmea-analysis.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('FMEA Analyses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('fmea-analyses')
export class FMEAAnalysisController {
  constructor(private readonly fmeaAnalysisService: FMEAAnalysisService) {}

  @Post()
  @ApiOperation({ summary: 'Create FMEA analysis' })
  @ApiResponse({ status: 201, description: 'Analysis created successfully', type: FMEAAnalysis })
  create(@Body() createDto: CreateFMEAAnalysisDto): Promise<FMEAAnalysis> {
    return this.fmeaAnalysisService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all FMEA analyses' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'organizationId', required: false })
  @ApiQuery({ name: 'rcaId', required: false })
  @ApiResponse({ status: 200, description: 'Return all analyses', type: [FMEAAnalysis] })
  findAll(
    @Query('tenantId') tenantId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('rcaId') rcaId?: string,
  ): Promise<FMEAAnalysis[]> {
    return this.fmeaAnalysisService.findAll({ tenantId, organizationId, rcaId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get FMEA analysis by ID' })
  @ApiResponse({ status: 200, description: 'Return analysis', type: FMEAAnalysis })
  findOne(@Param('id') id: string): Promise<FMEAAnalysis> {
    return this.fmeaAnalysisService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update FMEA analysis' })
  @ApiResponse({ status: 200, description: 'Analysis updated successfully', type: FMEAAnalysis })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateFMEAAnalysisDto,
  ): Promise<FMEAAnalysis> {
    return this.fmeaAnalysisService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete FMEA analysis' })
  @ApiResponse({ status: 204, description: 'Analysis deleted successfully' })
  remove(@Param('id') id: string): Promise<void> {
    return this.fmeaAnalysisService.remove(id);
  }
}

