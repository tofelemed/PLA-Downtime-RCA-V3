import { Controller, Get, Post, Put, Delete, Param, Body, Query, UsePipes, ValidationPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBody, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ReconcileFormService } from './reconcile-form.service';
import { ReconcileForm } from './reconcile-form.entity';
import { CreateReconcileFormDto } from './dto/create-reconcile-form.dto';
import { UpdateReconcileFormDto } from './dto/update-reconcile-form.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Reconcile Forms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reconcile-forms')
export class ReconcileFormController {
  constructor(private readonly formService: ReconcileFormService) {}

  @Get()
  @ApiResponse({ status: 200, description: 'List all reconcile forms', type: [ReconcileForm] })
  findAll(@Query('lossId') lossId?: string, @Query('tenantId') tenantId?: string): Promise<ReconcileForm[]> {
    if (lossId) return this.formService.findByLoss(lossId);
    if (tenantId) return this.formService.findByTenant(tenantId);
    return this.formService.findAll();
  }

  @Get(':id')
  @ApiResponse({ status: 200, description: 'Get reconcile form by ID', type: ReconcileForm })
  findOne(@Param('id') id: string): Promise<ReconcileForm | null> {
    return this.formService.findOne(id);
  }

  @Post()
  @ApiBody({ type: CreateReconcileFormDto })
  @ApiResponse({ status: 201, description: 'Create reconcile form', type: ReconcileForm })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  create(@Body() data: CreateReconcileFormDto): Promise<ReconcileForm> {
    return this.formService.create(data);
  }

  @Put(':id')
  @ApiBody({ type: UpdateReconcileFormDto })
  @ApiResponse({ status: 200, description: 'Update reconcile form', type: ReconcileForm })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  update(@Param('id') id: string, @Body() data: UpdateReconcileFormDto): Promise<ReconcileForm | null> {
    return this.formService.update(id, data);
  }

  @Delete(':id')
  @ApiResponse({ status: 200, description: 'Delete reconcile form' })
  remove(@Param('id') id: string): Promise<void> {
    return this.formService.remove(id);
  }
} 