import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ProductionPlanService } from './production-plan.service';
import { ProductionPlan } from './production-plan.entity';
import { ApiTags, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateProductionPlanDto } from './dto/create-production-plan.dto';
import { UpdateProductionPlanDto } from './dto/update-production-plan.dto';

@ApiTags('Production Plans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('production-plans')
export class ProductionPlanController {
  constructor(private readonly planService: ProductionPlanService) {}

  @Get()
  findAll(
    @Query('tenantId') tenantId?: string,
    @Query('status') status?: string,
  ): Promise<ProductionPlan[]> {
    if (tenantId) {
      return this.planService.findByTenant(tenantId);
    }
    if (status) {
      return this.planService.findByStatus(status);
    }
    return this.planService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<ProductionPlan | null> {
    return this.planService.findOne(id);
  }

  @Post()
  @ApiBody({ type: CreateProductionPlanDto })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  create(@Body() data: CreateProductionPlanDto): Promise<ProductionPlan> {
    const payload = this.transformDateFields(data);
    return this.planService.create(payload);
  }

  @Put(':id')
  @ApiBody({ type: UpdateProductionPlanDto })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  update(@Param('id') id: string, @Body() data: UpdateProductionPlanDto): Promise<ProductionPlan | null> {
    const payload = this.transformDateFields(data);
    return this.planService.update(id, payload);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.planService.remove(id);
  }

  private transformDateFields(data: unknown): Partial<ProductionPlan> {
    const dateFields: (keyof ProductionPlan)[] = ['startDate', 'endDate'];
    const transformed: Record<string, unknown> = { ...(data as Record<string, unknown>) };

    for (const field of dateFields) {
      const value = transformed[field as string];
      if (typeof value === 'string') {
        transformed[field as string] = value ? new Date(value) : undefined;
      }
    }

    return transformed as Partial<ProductionPlan>;
  }
} 