import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PIConnectionService } from './pi-connection.service';
import { CreatePIConnectionDto } from './dto/create-pi-connection.dto';
import { UpdatePIConnectionDto } from './dto/update-pi-connection.dto';
import { PIConnection } from './pi-connection.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('PI Connections')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pi-connections')
export class PIConnectionController {
  constructor(private readonly piConnectionService: PIConnectionService) {}

  @Post()
  @ApiOperation({ summary: 'Create PI connection' })
  @ApiResponse({ status: 201, description: 'Connection created successfully', type: PIConnection })
  create(@Body() createDto: CreatePIConnectionDto): Promise<PIConnection> {
    return this.piConnectionService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all PI connections' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'organizationId', required: false })
  @ApiResponse({ status: 200, description: 'Return all connections', type: [PIConnection] })
  findAll(
    @Query('tenantId') tenantId?: string,
    @Query('organizationId') organizationId?: string,
  ): Promise<PIConnection[]> {
    return this.piConnectionService.findAll({ tenantId, organizationId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get PI connection by ID' })
  @ApiResponse({ status: 200, description: 'Return connection', type: PIConnection })
  findOne(@Param('id') id: string): Promise<PIConnection> {
    return this.piConnectionService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update PI connection' })
  @ApiResponse({ status: 200, description: 'Connection updated successfully', type: PIConnection })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdatePIConnectionDto,
  ): Promise<PIConnection> {
    return this.piConnectionService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete PI connection' })
  @ApiResponse({ status: 204, description: 'Connection deleted successfully' })
  remove(@Param('id') id: string): Promise<void> {
    return this.piConnectionService.remove(id);
  }
}

