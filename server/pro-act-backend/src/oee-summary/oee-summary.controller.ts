import { Controller, Get, Post, Put, Delete, Param, Body, Query, UsePipes, ValidationPipe, UseGuards, Header } from '@nestjs/common';
import { ApiTags, ApiBody, ApiBearerAuth, ApiResponse, ApiOperation } from '@nestjs/swagger';
import { OEESummaryService } from './oee-summary.service';
import { OEESummary } from './oee-summary.entity';
import { CreateOEESummaryDto } from './dto/create-oee-summary.dto';
import { UpdateOeeSummaryDto } from './dto/update-oee-summary.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

/**
 * Deprecated writes (plan 2.5 step 6, §14.3): OEE is computed on the server from calculation runs (2.5 / 2.7);
 * the write routes answer with `Deprecation: true` and become 410 Gone when the 3.5 dashboard ships.
 */
const DEPRECATED_WRITE =
  'Deprecated (plan 2.5): OEE comes from server calculation runs; this write becomes 410 Gone with plan 3.5.';

@ApiTags('OEE Summaries')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('oee-summaries')
export class OEESummaryController {
  constructor(private readonly summaryService: OEESummaryService) {}

  @Get()
  @ApiResponse({ status: 200, description: 'List all OEE summaries', type: [OEESummary] })
  findAll(@Query('planId') planId?: string, @Query('tenantId') tenantId?: string): Promise<OEESummary[]> {
    if (planId) return this.summaryService.findByPlan(planId);
    if (tenantId) return this.summaryService.findByTenant(tenantId);
    return this.summaryService.findAll();
  }

  @Get(':id')
  @ApiResponse({ status: 200, description: 'Get OEE summary by ID', type: OEESummary })
  findOne(@Param('id') id: string): Promise<OEESummary | null> {
    return this.summaryService.findOne(id);
  }

  @Post()
  @Header('Deprecation', 'true')
  @ApiOperation({ deprecated: true, description: DEPRECATED_WRITE })
  @ApiBody({ type: CreateOEESummaryDto })
  @ApiResponse({ status: 201, description: 'Create OEE summary', type: OEESummary })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  create(@Body() data: CreateOEESummaryDto): Promise<OEESummary> {
    return this.summaryService.create(data);
  }

  @Put(':id')
  @Header('Deprecation', 'true')
  @ApiOperation({ deprecated: true, description: DEPRECATED_WRITE })
  @ApiBody({ type: UpdateOeeSummaryDto })
  @ApiResponse({ status: 200, description: 'Update OEE summary', type: OEESummary })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  update(@Param('id') id: string, @Body() data: UpdateOeeSummaryDto): Promise<OEESummary | null> {
    return this.summaryService.update(id, data);
  }

  @Delete(':id')
  @Header('Deprecation', 'true')
  @ApiOperation({ deprecated: true, description: DEPRECATED_WRITE })
  @ApiResponse({ status: 200, description: 'Delete OEE summary' })
  remove(@Param('id') id: string): Promise<void> {
    return this.summaryService.remove(id);
  }
} 