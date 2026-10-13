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
import { FiveWhyAnalysisService } from './five-why-analysis.service';
import { CreateFiveWhyAnalysisDto } from './dto/create-five-why-analysis.dto';
import { UpdateFiveWhyAnalysisDto } from './dto/update-five-why-analysis.dto';
import { FiveWhyAnalysis } from './five-why-analysis.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RCA_WRITERS } from '../rca-case/rca-scope';

@ApiTags('Five Why Analyses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('five-why-analyses')
export class FiveWhyAnalysisController {
  constructor(
    private readonly fiveWhyAnalysisService: FiveWhyAnalysisService,
  ) {}

  @Roles(...RCA_WRITERS)
  @Post()
  @ApiOperation({ summary: 'Create Five Why analysis' })
  @ApiResponse({
    status: 201,
    description: 'Analysis created successfully',
    type: FiveWhyAnalysis,
  })
  create(
    @Body() createDto: CreateFiveWhyAnalysisDto,
  ): Promise<FiveWhyAnalysis> {
    return this.fiveWhyAnalysisService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all Five Why analyses' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'organizationId', required: false })
  @ApiQuery({ name: 'rcaId', required: false })
  @ApiResponse({
    status: 200,
    description: 'Return all analyses',
    type: [FiveWhyAnalysis],
  })
  findAll(
    @Query('tenantId') tenantId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('rcaId') rcaId?: string,
  ): Promise<FiveWhyAnalysis[]> {
    return this.fiveWhyAnalysisService.findAll({
      tenantId,
      organizationId,
      rcaId,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get Five Why analysis by ID' })
  @ApiResponse({
    status: 200,
    description: 'Return analysis',
    type: FiveWhyAnalysis,
  })
  findOne(@Param('id') id: string): Promise<FiveWhyAnalysis> {
    return this.fiveWhyAnalysisService.findOne(id);
  }

  @Roles(...RCA_WRITERS)
  @Patch(':id')
  @ApiOperation({ summary: 'Update Five Why analysis' })
  @ApiResponse({
    status: 200,
    description: 'Analysis updated successfully',
    type: FiveWhyAnalysis,
  })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateFiveWhyAnalysisDto,
  ): Promise<FiveWhyAnalysis> {
    return this.fiveWhyAnalysisService.update(id, updateDto);
  }

  @Roles(...RCA_WRITERS)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete Five Why analysis' })
  @ApiResponse({ status: 204, description: 'Analysis deleted successfully' })
  remove(@Param('id') id: string): Promise<void> {
    return this.fiveWhyAnalysisService.remove(id);
  }
}
