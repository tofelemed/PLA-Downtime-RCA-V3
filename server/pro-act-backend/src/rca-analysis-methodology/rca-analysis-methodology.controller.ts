import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Param,
  Put,
  Delete,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RCAAnalysisMethodologyService } from './rca-analysis-methodology.service';
import { CreateFiveWhyAnalysisDto } from './dto/create-five-why-analysis.dto';
import { UpdateFiveWhyAnalysisDto } from './dto/update-five-why-analysis.dto';
import { RcaFiveWhyAnalysis } from './entities/five-why-analysis.entity';
import { CreateFishboneDiagramDto } from './dto/create-fishbone-diagram.dto';
import { UpdateFishboneDiagramDto } from './dto/update-fishbone-diagram.dto';
import { RcaFishboneDiagram } from './entities/fishbone-diagram.entity';
import { CreateFmeaAnalysisDto } from './dto/create-fmea-analysis.dto';
import { UpdateFmeaAnalysisDto } from './dto/update-fmea-analysis.dto';
import { RcaFmeaAnalysis } from './entities/fmea-analysis.entity';
import { CreateFaultTreeAnalysisDto } from './dto/create-fault-tree-analysis.dto';
import { UpdateFaultTreeAnalysisDto } from './dto/update-fault-tree-analysis.dto';
import { RcaFaultTreeAnalysis } from './entities/fault-tree-analysis.entity';
import { CreateBarrierAnalysisDto } from './dto/create-barrier-analysis.dto';
import { UpdateBarrierAnalysisDto } from './dto/update-barrier-analysis.dto';
import { RcaBarrierAnalysis } from './entities/barrier-analysis.entity';
import { CreateChangeAnalysisDto } from './dto/create-change-analysis.dto';
import { UpdateChangeAnalysisDto } from './dto/update-change-analysis.dto';
import { RcaChangeAnalysis } from './entities/change-analysis.entity';

@ApiTags('RCA Analysis Methodology')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rca-analysis')
export class RCAAnalysisMethodologyController {
  constructor(private readonly service: RCAAnalysisMethodologyService) {}

  // Five Why
  @Post('five-why')
  @ApiOperation({ summary: 'Create Five Why analysis' })
  @ApiResponse({ status: 201, type: RcaFiveWhyAnalysis })
  createFiveWhy(@Body() dto: CreateFiveWhyAnalysisDto) {
    return this.service.createFiveWhy(dto);
  }

  @Get('five-why')
  @ApiOperation({ summary: 'Get Five Why analysis by RCA' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'rcaId', required: true })
  @ApiResponse({ status: 200, type: RcaFiveWhyAnalysis })
  getFiveWhy(@Query('tenantId') tenantId: string | undefined, @Query('rcaId') rcaId: string) {
    return this.service.findFiveWhyByRca(tenantId, rcaId);
  }

  @Put('five-why/:id')
  @ApiOperation({ summary: 'Update Five Why analysis' })
  @ApiResponse({ status: 200, type: RcaFiveWhyAnalysis })
  updateFiveWhy(@Param('id') id: string, @Body() dto: UpdateFiveWhyAnalysisDto) {
    return this.service.updateFiveWhy(id, dto);
  }

  @Delete('five-why/:id')
  @ApiOperation({ summary: 'Delete Five Why analysis' })
  removeFiveWhy(@Param('id') id: string) {
    return this.service.deleteFiveWhy(id);
  }

  // Fishbone
  @Post('fishbone')
  @ApiOperation({ summary: 'Create Fishbone diagram' })
  @ApiResponse({ status: 201, type: RcaFishboneDiagram })
  createFishbone(@Body() dto: CreateFishboneDiagramDto) {
    return this.service.createFishbone(dto);
  }

  @Get('fishbone')
  @ApiOperation({ summary: 'Get Fishbone diagram by RCA' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'rcaId', required: true })
  @ApiResponse({ status: 200, type: RcaFishboneDiagram })
  getFishbone(@Query('tenantId') tenantId: string | undefined, @Query('rcaId') rcaId: string) {
    return this.service.findFishboneByRca(tenantId, rcaId);
  }

  @Put('fishbone/:id')
  @ApiOperation({ summary: 'Update Fishbone diagram' })
  @ApiResponse({ status: 200, type: RcaFishboneDiagram })
  updateFishbone(@Param('id') id: string, @Body() dto: UpdateFishboneDiagramDto) {
    return this.service.updateFishbone(id, dto);
  }

  @Delete('fishbone/:id')
  @ApiOperation({ summary: 'Delete Fishbone diagram' })
  removeFishbone(@Param('id') id: string) {
    return this.service.deleteFishbone(id);
  }

  // FMEA
  @Post('fmea')
  @ApiOperation({ summary: 'Create FMEA analysis' })
  @ApiResponse({ status: 201, type: RcaFmeaAnalysis })
  createFmea(@Body() dto: CreateFmeaAnalysisDto) {
    return this.service.createFmea(dto);
  }

  @Get('fmea')
  @ApiOperation({ summary: 'Get FMEA analysis by RCA' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'rcaId', required: true })
  @ApiResponse({ status: 200, type: RcaFmeaAnalysis })
  getFmea(@Query('tenantId') tenantId: string | undefined, @Query('rcaId') rcaId: string) {
    return this.service.findFmeaByRca(tenantId, rcaId);
  }

  @Put('fmea/:id')
  @ApiOperation({ summary: 'Update FMEA analysis' })
  @ApiResponse({ status: 200, type: RcaFmeaAnalysis })
  updateFmea(@Param('id') id: string, @Body() dto: UpdateFmeaAnalysisDto) {
    return this.service.updateFmea(id, dto);
  }

  @Delete('fmea/:id')
  @ApiOperation({ summary: 'Delete FMEA analysis' })
  removeFmea(@Param('id') id: string) {
    return this.service.deleteFmea(id);
  }

  // Fault tree
  @Post('fault-tree')
  @ApiOperation({ summary: 'Create fault tree analysis' })
  @ApiResponse({ status: 201, type: RcaFaultTreeAnalysis })
  createFaultTree(@Body() dto: CreateFaultTreeAnalysisDto) {
    return this.service.createFaultTree(dto);
  }

  @Get('fault-tree')
  @ApiOperation({ summary: 'Get fault tree analysis by RCA' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'rcaId', required: true })
  @ApiResponse({ status: 200, type: RcaFaultTreeAnalysis })
  getFaultTree(@Query('tenantId') tenantId: string | undefined, @Query('rcaId') rcaId: string) {
    return this.service.findFaultTreeByRca(tenantId, rcaId);
  }

  @Put('fault-tree/:id')
  @ApiOperation({ summary: 'Update fault tree analysis' })
  @ApiResponse({ status: 200, type: RcaFaultTreeAnalysis })
  updateFaultTree(@Param('id') id: string, @Body() dto: UpdateFaultTreeAnalysisDto) {
    return this.service.updateFaultTree(id, dto);
  }

  @Delete('fault-tree/:id')
  @ApiOperation({ summary: 'Delete fault tree analysis' })
  removeFaultTree(@Param('id') id: string) {
    return this.service.deleteFaultTree(id);
  }

  // Barrier
  @Post('barrier')
  @ApiOperation({ summary: 'Create barrier analysis' })
  @ApiResponse({ status: 201, type: RcaBarrierAnalysis })
  createBarrier(@Body() dto: CreateBarrierAnalysisDto) {
    return this.service.createBarrier(dto);
  }

  @Get('barrier')
  @ApiOperation({ summary: 'Get barrier analysis by RCA' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'rcaId', required: true })
  @ApiResponse({ status: 200, type: RcaBarrierAnalysis })
  getBarrier(@Query('tenantId') tenantId: string | undefined, @Query('rcaId') rcaId: string) {
    return this.service.findBarrierByRca(tenantId, rcaId);
  }

  @Put('barrier/:id')
  @ApiOperation({ summary: 'Update barrier analysis' })
  @ApiResponse({ status: 200, type: RcaBarrierAnalysis })
  updateBarrier(@Param('id') id: string, @Body() dto: UpdateBarrierAnalysisDto) {
    return this.service.updateBarrier(id, dto);
  }

  @Delete('barrier/:id')
  @ApiOperation({ summary: 'Delete barrier analysis' })
  removeBarrier(@Param('id') id: string) {
    return this.service.deleteBarrier(id);
  }

  // Change analysis
  @Post('change')
  @ApiOperation({ summary: 'Create change analysis' })
  @ApiResponse({ status: 201, type: RcaChangeAnalysis })
  createChange(@Body() dto: CreateChangeAnalysisDto) {
    return this.service.createChange(dto);
  }

  @Get('change')
  @ApiOperation({ summary: 'Get change analysis by RCA' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'rcaId', required: true })
  @ApiResponse({ status: 200, type: RcaChangeAnalysis })
  getChange(@Query('tenantId') tenantId: string | undefined, @Query('rcaId') rcaId: string) {
    return this.service.findChangeByRca(tenantId, rcaId);
  }

  @Put('change/:id')
  @ApiOperation({ summary: 'Update change analysis' })
  @ApiResponse({ status: 200, type: RcaChangeAnalysis })
  updateChange(@Param('id') id: string, @Body() dto: UpdateChangeAnalysisDto) {
    return this.service.updateChange(id, dto);
  }

  @Delete('change/:id')
  @ApiOperation({ summary: 'Delete change analysis' })
  removeChange(@Param('id') id: string) {
    return this.service.deleteChange(id);
  }
}


