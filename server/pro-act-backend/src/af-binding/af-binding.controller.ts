import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AfBindingService } from './af-binding.service';
import { CreateAfBindingDto } from './dto/create-af-binding.dto';
import { UpdateAfBindingDto } from './dto/update-af-binding.dto';
import { AfBinding } from './af-binding.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('AF Bindings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('af-bindings')
export class AfBindingController {
  constructor(private readonly afBindingService: AfBindingService) {}

  @Post()
  @ApiOperation({ summary: 'Create AF binding' })
  @ApiResponse({ status: 201, description: 'Binding created successfully', type: AfBinding })
  create(@Body() createDto: CreateAfBindingDto): Promise<AfBinding> {
    return this.afBindingService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all AF bindings' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'organizationId', required: false })
  @ApiQuery({ name: 'boundType', required: false })
  @ApiQuery({ name: 'localId', required: false })
  @ApiResponse({ status: 200, description: 'Return all bindings', type: [AfBinding] })
  findAll(
    @Query('tenantId') tenantId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('boundType') boundType?: string,
    @Query('localId') localId?: string,
  ): Promise<AfBinding[]> {
    return this.afBindingService.findAll({ tenantId, organizationId, boundType, localId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get AF binding by ID' })
  @ApiResponse({ status: 200, description: 'Return binding', type: AfBinding })
  findOne(@Param('id') id: string): Promise<AfBinding> {
    return this.afBindingService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update AF binding' })
  @ApiResponse({ status: 200, description: 'Binding updated successfully', type: AfBinding })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateAfBindingDto,
  ): Promise<AfBinding> {
    return this.afBindingService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete AF binding' })
  @ApiResponse({ status: 204, description: 'Binding deleted successfully' })
  remove(@Param('id') id: string): Promise<void> {
    return this.afBindingService.remove(id);
  }
}

