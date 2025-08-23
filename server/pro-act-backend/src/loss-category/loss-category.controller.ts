import { Controller, Get, Post, Put, Delete, Param, Body, Query, UsePipes, ValidationPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBody, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { LossCategoryService } from './loss-category.service';
import { LossCategory } from './loss-category.entity';
import { CreateLossCategoryDto } from './dto/create-loss-category.dto';
import { UpdateLossCategoryDto } from './dto/update-loss-category.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

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
  @ApiBody({ type: CreateLossCategoryDto })
  @ApiResponse({ status: 201, description: 'Create loss category', type: LossCategory })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  create(@Body() data: CreateLossCategoryDto): Promise<LossCategory> {
    return this.categoryService.create(data);
  }

  @Put(':id')
  @ApiBody({ type: UpdateLossCategoryDto })
  @ApiResponse({ status: 200, description: 'Update loss category', type: LossCategory })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  update(@Param('id') id: string, @Body() data: UpdateLossCategoryDto): Promise<LossCategory | null> {
    return this.categoryService.update(id, data);
  }

  @Delete(':id')
  @ApiResponse({ status: 200, description: 'Delete loss category' })
  remove(@Param('id') id: string): Promise<void> {
    return this.categoryService.remove(id);
  }
} 