import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { FaultTreeAnalysisService } from './fault-tree-analysis.service';
import { CreateFaultTreeAnalysisDto } from './dto/create-fault-tree-analysis.dto';
import { UpdateFaultTreeAnalysisDto } from './dto/update-fault-tree-analysis.dto';
import { FaultTreeAnalysis } from './fault-tree-analysis.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RCA_WRITERS } from '../rca-case/rca-scope';

@ApiTags('Fault Tree Analyses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('fault-tree-analyses')
export class FaultTreeAnalysisController {
  constructor(
    private readonly faultTreeAnalysisService: FaultTreeAnalysisService,
  ) {}

  @Roles(...RCA_WRITERS)
  @Post()
  @ApiOperation({ summary: 'Create fault tree analysis' })
  @ApiResponse({
    status: 201,
    description: 'Analysis created successfully',
    type: FaultTreeAnalysis,
  })
  create(
    @Body() createDto: CreateFaultTreeAnalysisDto,
  ): Promise<FaultTreeAnalysis> {
    return this.faultTreeAnalysisService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all fault tree analyses' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'organizationId', required: false })
  @ApiQuery({ name: 'rcaId', required: false })
  @ApiResponse({
    status: 200,
    description: 'Return all analyses',
    type: [FaultTreeAnalysis],
  })
  findAll(
    @Query('tenantId') tenantId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('rcaId') rcaId?: string,
  ): Promise<FaultTreeAnalysis[]> {
    return this.faultTreeAnalysisService.findAll({
      tenantId,
      organizationId,
      rcaId,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get fault tree analysis by ID' })
  @ApiResponse({
    status: 200,
    description: 'Return analysis',
    type: FaultTreeAnalysis,
  })
  findOne(@Param('id') id: string): Promise<FaultTreeAnalysis> {
    return this.faultTreeAnalysisService.findOne(id);
  }

  @Roles(...RCA_WRITERS)
  @Patch(':id')
  @ApiOperation({ summary: 'Update fault tree analysis' })
  @ApiResponse({
    status: 200,
    description: 'Analysis updated successfully',
    type: FaultTreeAnalysis,
  })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateFaultTreeAnalysisDto,
  ): Promise<FaultTreeAnalysis> {
    return this.faultTreeAnalysisService.update(id, updateDto);
  }

  @Roles(...RCA_WRITERS)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete fault tree analysis' })
  @ApiResponse({ status: 204, description: 'Analysis deleted successfully' })
  remove(@Param('id') id: string): Promise<void> {
    return this.faultTreeAnalysisService.remove(id);
  }
}
