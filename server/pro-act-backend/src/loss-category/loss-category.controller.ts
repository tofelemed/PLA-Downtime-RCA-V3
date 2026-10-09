import { Controller, Get, Post, Put, Delete, Param, Body, Query, UsePipes, ValidationPipe, UseGuards, Header } from '@nestjs/common';
import { ApiTags, ApiBody, ApiBearerAuth, ApiResponse, ApiOperation } from '@nestjs/swagger';
import { LossCategoryService } from './loss-category.service';
import { LossCategory } from './loss-category.entity';
import { CreateLossCategoryDto } from './dto/create-loss-category.dto';
import { UpdateLossCategoryDto } from './dto/update-loss-category.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlanDashboardV1WriteGuard } from '../feature-flags/plan-dashboard-v1-write.guard';

/**
 * Deprecated writes (plan 2.8, §14.3): reconciliation lines are saved atomically and validated through
 * `PUT /api/v2/production-periods/{id}/draft-lines` (decisions, manual lines with event evidence, audit);
 * these writes answer with `Deprecation: true` and answer 410 Gone (`V1_WRITE_GONE`) for tenants whose `v2.planDashboard` flag is on (plan 3.5).
 */
const DEPRECATED_WRITE =
  'Deprecated (plan 2.8): use PUT /api/v2/production-periods/{id}/draft-lines; 410 Gone while the tenant’s v2.planDashboard flag is on (plan 3.5).';

@ApiTags('Loss Categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('loss-categories')
export class LossCategoryController {
  constructor(private readonly categoryService: LossCategoryService) {}

  @Get()
  @ApiResponse({ status: 200, description: 'List all loss categories', type: [LossCategory] })
  findAll(@Query('reconcileFormId') reconcileFormId?: string, @Query('tenantId') tenantId?: string): Promise<LossCategory[]> {
    if (reconcileFormId) return this.categoryService.findByReconcileForm(reconcileFormId);
    if (tenantId) return this.categoryService.findByTenant(tenantId);
    return this.categoryService.findAll();
  }

  @Get(':id')
  @ApiResponse({ status: 200, description: 'Get loss category by ID', type: LossCategory })
  findOne(@Param('id') id: string): Promise<LossCategory | null> {
    return this.categoryService.findOne(id);
  }

  @Post()
  @Header('Deprecation', 'true')
  @UseGuards(PlanDashboardV1WriteGuard)
  @ApiOperation({ deprecated: true, description: DEPRECATED_WRITE })
  @ApiBody({ type: CreateLossCategoryDto })
  @ApiResponse({ status: 201, description: 'Create loss category', type: LossCategory })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  create(@Body() data: CreateLossCategoryDto): Promise<LossCategory> {
    return this.categoryService.create(data);
  }

  @Put(':id')
  @Header('Deprecation', 'true')
  @UseGuards(PlanDashboardV1WriteGuard)
  @ApiOperation({ deprecated: true, description: DEPRECATED_WRITE })
  @ApiBody({ type: UpdateLossCategoryDto })
  @ApiResponse({ status: 200, description: 'Update loss category', type: LossCategory })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  update(@Param('id') id: string, @Body() data: UpdateLossCategoryDto): Promise<LossCategory | null> {
    return this.categoryService.update(id, data);
  }

  @Delete(':id')
  @Header('Deprecation', 'true')
  @UseGuards(PlanDashboardV1WriteGuard)
  @ApiOperation({ deprecated: true, description: DEPRECATED_WRITE })
  @ApiResponse({ status: 200, description: 'Delete loss category' })
  remove(@Param('id') id: string): Promise<void> {
    return this.categoryService.remove(id);
  }
} 