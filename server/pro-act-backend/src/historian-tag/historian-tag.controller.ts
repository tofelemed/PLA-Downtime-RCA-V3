import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { HistorianTagService } from './historian-tag.service';
import { CreateHistorianTagDto } from './dto/create-historian-tag.dto';
import { UpdateHistorianTagDto } from './dto/update-historian-tag.dto';
import { HistorianTag } from './historian-tag.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Historian Tags')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('historian-tags')
export class HistorianTagController {
  constructor(private readonly historianTagService: HistorianTagService) {}

  @Post()
  @ApiOperation({ summary: 'Create historian tag' })
  @ApiResponse({ status: 201, description: 'Tag created successfully', type: HistorianTag })
  create(@Body() createDto: CreateHistorianTagDto): Promise<HistorianTag> {
    return this.historianTagService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all historian tags' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'organizationId', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'enabled', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Return all tags', type: [HistorianTag] })
  findAll(
    @Query('tenantId') tenantId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('category') category?: string,
    @Query('enabled') enabled?: boolean,
  ): Promise<HistorianTag[]> {
    return this.historianTagService.findAll({ tenantId, organizationId, category, enabled });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get historian tag by ID' })
  @ApiResponse({ status: 200, description: 'Return tag', type: HistorianTag })
  findOne(@Param('id') id: string): Promise<HistorianTag> {
    return this.historianTagService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update historian tag' })
  @ApiResponse({ status: 200, description: 'Tag updated successfully', type: HistorianTag })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateHistorianTagDto,
  ): Promise<HistorianTag> {
    return this.historianTagService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete historian tag' })
  @ApiResponse({ status: 204, description: 'Tag deleted successfully' })
  remove(@Param('id') id: string): Promise<void> {
    return this.historianTagService.remove(id);
  }
}

