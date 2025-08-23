import { Controller, Get, Post, Put, Delete, Param, Body, Query, UsePipes, ValidationPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBody, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ProductionLossService } from './production-loss.service';
import { ProductionLoss } from './production-loss.entity';
import { CreateProductionLossDto } from './dto/create-production-loss.dto';
import { UpdateProductionLossDto } from './dto/update-production-loss.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Production Losses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('production-losses')
export class ProductionLossController {
  constructor(private readonly lossService: ProductionLossService) {}

  @Get()
  @ApiResponse({ status: 200, description: 'List all production losses', type: [ProductionLoss] })
  findAll(@Query('planId') planId?: string, @Query('tenantId') tenantId?: string): Promise<ProductionLoss[]> {
    if (planId) return this.lossService.findByPlan(planId);
    if (tenantId) return this.lossService.findByTenant(tenantId);
    return this.lossService.findAll();
  }

  @Get(':id')
  @ApiResponse({ status: 200, description: 'Get production loss by ID', type: ProductionLoss })
  findOne(@Param('id') id: string): Promise<ProductionLoss | null> {
    return this.lossService.findOne(id);
  }

  @Post()
  @ApiBody({ type: CreateProductionLossDto })
  @ApiResponse({ status: 201, description: 'Create production loss', type: ProductionLoss })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  create(@Body() data: CreateProductionLossDto): Promise<ProductionLoss> {
    return this.lossService.create(data);
  }

  @Put(':id')
  @ApiBody({ type: UpdateProductionLossDto })
  @ApiResponse({ status: 200, description: 'Update production loss', type: ProductionLoss })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  update(@Param('id') id: string, @Body() data: UpdateProductionLossDto): Promise<ProductionLoss | null> {
    return this.lossService.update(id, data);
  }

  @Delete(':id')
  @ApiResponse({ status: 200, description: 'Delete production loss' })
  remove(@Param('id') id: string): Promise<void> {
    return this.lossService.remove(id);
  }
} 