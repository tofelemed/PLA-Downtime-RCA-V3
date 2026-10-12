import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ProductionPlanTemplateService } from './production-plan-template.service';
import { ProductionPlanTemplate } from './production-plan-template.entity';
import { ApiTags, ApiBearerAuth, ApiResponse, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { findOrThrow } from '../common/helpers/find-or-throw';

@ApiTags('Production Plan Templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('production-plan-templates')
export class ProductionPlanTemplateController {
  constructor(private readonly templateService: ProductionPlanTemplateService) {}

  @Get()
  @ApiResponse({ status: 200, description: 'List all production plan templates', type: [ProductionPlanTemplate] })
  findAll(@Query('tenantId') tenantId?: string): Promise<ProductionPlanTemplate[]> {
    if (tenantId) {
      return this.templateService.findByTenant(tenantId);
    }
    return this.templateService.findAll();
  }

  @Get(':id')
  @ApiResponse({ status: 200, description: 'Get production plan template by ID', type: ProductionPlanTemplate })
  findOne(@Param('id') id: string): Promise<ProductionPlanTemplate> {
    return findOrThrow(this.templateService.findOne(id), 'ProductionPlanTemplate', id);
  }

  @Post()
  @ApiBody({ type: ProductionPlanTemplate })
  @ApiResponse({ status: 201, description: 'Create production plan template', type: ProductionPlanTemplate })
  create(@Body() data: Partial<ProductionPlanTemplate>): Promise<ProductionPlanTemplate> {
    return this.templateService.create(data);
  }

  @Put(':id')
  @ApiBody({ type: ProductionPlanTemplate })
  @ApiResponse({ status: 200, description: 'Update production plan template', type: ProductionPlanTemplate })
  update(@Param('id') id: string, @Body() data: Partial<ProductionPlanTemplate>): Promise<ProductionPlanTemplate | null> {
    return this.templateService.update(id, data);
  }

  @Delete(':id')
  @ApiResponse({ status: 200, description: 'Delete production plan template' })
  remove(@Param('id') id: string): Promise<void> {
    return this.templateService.remove(id);
  }
} 