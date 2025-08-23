import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { Tenant } from './tenant.entity';
import { ApiBody, ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Tenants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get()
  @ApiResponse({ status: 200, description: 'List all tenants', type: [Tenant] })
  findAll(): Promise<Tenant[]> {
    return this.tenantService.findAll();
  }

  @Get(':id')
  @ApiResponse({ status: 200, description: 'Get tenant by ID', type: Tenant })
  findOne(@Param('id') id: string): Promise<Tenant | null> {
    return this.tenantService.findOne(id);
  }

  @Post()
  @ApiBody({ type: CreateTenantDto })
  @ApiResponse({ status: 201, description: 'Create tenant', type: Tenant })
  create(@Body() data: CreateTenantDto): Promise<Tenant> {
    return this.tenantService.create(data);
  }

  @Put(':id')
  @ApiBody({ type: UpdateTenantDto })
  @ApiResponse({ status: 200, description: 'Update tenant', type: Tenant })
  update(@Param('id') id: string, @Body() data: UpdateTenantDto): Promise<Tenant | null> {
    return this.tenantService.update(id, data);
  }

  @Delete(':id')
  @ApiResponse({ status: 200, description: 'Delete tenant' })
  remove(@Param('id') id: string): Promise<void> {
    return this.tenantService.remove(id);
  }
} 