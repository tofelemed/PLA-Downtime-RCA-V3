import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { BarrierAnalysisService } from './barrier-analysis.service';
import { CreateBarrierAnalysisDto } from './dto/create-barrier-analysis.dto';
import { UpdateBarrierAnalysisDto } from './dto/update-barrier-analysis.dto';
import { BarrierAnalysis } from './barrier-analysis.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Barrier Analyses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('barrier-analyses')
export class BarrierAnalysisController {
  constructor(private readonly barrierAnalysisService: BarrierAnalysisService) {}

  @Post()
  @ApiOperation({ summary: 'Create barrier analysis' })
  @ApiResponse({ status: 201, description: 'Analysis created successfully', type: BarrierAnalysis })
  create(@Body() createDto: CreateBarrierAnalysisDto): Promise<BarrierAnalysis> {
    return this.barrierAnalysisService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all barrier analyses' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'organizationId', required: false })
  @ApiQuery({ name: 'rcaId', required: false })
  @ApiResponse({ status: 200, description: 'Return all analyses', type: [BarrierAnalysis] })
  findAll(
    @Query('tenantId') tenantId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('rcaId') rcaId?: string,
  ): Promise<BarrierAnalysis[]> {
    return this.barrierAnalysisService.findAll({ tenantId, organizationId, rcaId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get barrier analysis by ID' })
  @ApiResponse({ status: 200, description: 'Return analysis', type: BarrierAnalysis })
  findOne(@Param('id') id: string): Promise<BarrierAnalysis> {
    return this.barrierAnalysisService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update barrier analysis' })
  @ApiResponse({ status: 200, description: 'Analysis updated successfully', type: BarrierAnalysis })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateBarrierAnalysisDto,
  ): Promise<BarrierAnalysis> {
    return this.barrierAnalysisService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete barrier analysis' })
  @ApiResponse({ status: 204, description: 'Analysis deleted successfully' })
  remove(@Param('id') id: string): Promise<void> {
    return this.barrierAnalysisService.remove(id);
  }
}

