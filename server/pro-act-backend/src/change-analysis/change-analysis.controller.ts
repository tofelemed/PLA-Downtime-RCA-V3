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
import { ChangeAnalysisService } from './change-analysis.service';
import { CreateChangeAnalysisDto } from './dto/create-change-analysis.dto';
import { UpdateChangeAnalysisDto } from './dto/update-change-analysis.dto';
import { ChangeAnalysis } from './change-analysis.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RCA_WRITERS } from '../rca-case/rca-scope';

@ApiTags('Change Analyses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('change-analyses')
export class ChangeAnalysisController {
  constructor(private readonly changeAnalysisService: ChangeAnalysisService) {}

  @Roles(...RCA_WRITERS)
  @Post()
  @ApiOperation({ summary: 'Create change analysis' })
  @ApiResponse({
    status: 201,
    description: 'Analysis created successfully',
    type: ChangeAnalysis,
  })
  create(@Body() createDto: CreateChangeAnalysisDto): Promise<ChangeAnalysis> {
    return this.changeAnalysisService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all change analyses' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'organizationId', required: false })
  @ApiQuery({ name: 'rcaId', required: false })
  @ApiResponse({
    status: 200,
    description: 'Return all analyses',
    type: [ChangeAnalysis],
  })
  findAll(
    @Query('tenantId') tenantId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('rcaId') rcaId?: string,
  ): Promise<ChangeAnalysis[]> {
    return this.changeAnalysisService.findAll({
      tenantId,
      organizationId,
      rcaId,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get change analysis by ID' })
  @ApiResponse({
    status: 200,
    description: 'Return analysis',
    type: ChangeAnalysis,
  })
  findOne(@Param('id') id: string): Promise<ChangeAnalysis> {
    return this.changeAnalysisService.findOne(id);
  }

  @Roles(...RCA_WRITERS)
  @Patch(':id')
  @ApiOperation({ summary: 'Update change analysis' })
  @ApiResponse({
    status: 200,
    description: 'Analysis updated successfully',
    type: ChangeAnalysis,
  })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateChangeAnalysisDto,
  ): Promise<ChangeAnalysis> {
    return this.changeAnalysisService.update(id, updateDto);
  }

  @Roles(...RCA_WRITERS)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete change analysis' })
  @ApiResponse({ status: 204, description: 'Analysis deleted successfully' })
  remove(@Param('id') id: string): Promise<void> {
    return this.changeAnalysisService.remove(id);
  }
}
