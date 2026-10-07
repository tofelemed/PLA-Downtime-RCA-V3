import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PIAfElementService } from './pi-af-element.service';
import { CreatePIAfElementDto } from './dto/create-pi-af-element.dto';
import { UpdatePIAfElementDto } from './dto/update-pi-af-element.dto';
import { PIAfElement } from './pi-af-element.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('PI AF Elements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pi-af-elements')
export class PIAfElementController {
  constructor(private readonly piAfElementService: PIAfElementService) {}

  @Post()
  @ApiOperation({ summary: 'Create PI AF element' })
  @ApiResponse({ status: 201, description: 'Element created successfully', type: PIAfElement })
  create(@Body() createDto: CreatePIAfElementDto): Promise<PIAfElement> {
    return this.piAfElementService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all PI AF elements' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'organizationId', required: false })
  @ApiQuery({ name: 'parentId', required: false })
  @ApiQuery({ name: 'template', required: false })
  @ApiQuery({ name: 'webId', required: false })
  @ApiResponse({ status: 200, description: 'Return all elements', type: [PIAfElement] })
  findAll(
    @Query('tenantId') tenantId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('parentId') parentId?: string,
    @Query('template') template?: string,
    @Query('webId') webId?: string,
  ): Promise<PIAfElement[]> {
    return this.piAfElementService.findAll({ tenantId, organizationId, parentId, template, webId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get PI AF element by ID' })
  @ApiResponse({ status: 200, description: 'Return element', type: PIAfElement })
  findOne(@Param('id') id: string): Promise<PIAfElement> {
    return this.piAfElementService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update PI AF element' })
  @ApiResponse({ status: 200, description: 'Element updated successfully', type: PIAfElement })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdatePIAfElementDto,
  ): Promise<PIAfElement> {
    return this.piAfElementService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete PI AF element' })
  @ApiResponse({ status: 204, description: 'Element deleted successfully' })
  remove(@Param('id') id: string): Promise<void> {
    return this.piAfElementService.remove(id);
  }
}

