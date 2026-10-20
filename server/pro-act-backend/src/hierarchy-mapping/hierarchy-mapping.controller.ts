import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UsePipes,
  ValidationPipe,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { HierarchyMappingService } from './hierarchy-mapping.service';
import { SourceHierarchyMapping } from './entities/source-hierarchy-mapping.entity';
import { CreateSourceHierarchyMappingDto } from './dto/create-source-hierarchy-mapping.dto';
import { UpdateSourceHierarchyMappingDto } from './dto/update-source-hierarchy-mapping.dto';
import { HierarchyIds, MappingRequest } from './dto/hierarchy-ids.dto';

@ApiTags('Hierarchy Mappings')
@ApiBearerAuth()
@Controller('hierarchy-mappings')
export class HierarchyMappingController {
  constructor(private readonly mappingService: HierarchyMappingService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new hierarchy mapping' })
  @ApiResponse({
    status: 201,
    description: 'Mapping created successfully',
    type: SourceHierarchyMapping,
  })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  create(
    @Body() createDto: CreateSourceHierarchyMappingDto,
  ): Promise<SourceHierarchyMapping> {
    return this.mappingService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all hierarchy mappings' })
  @ApiQuery({ name: 'tenantId', required: true, description: 'Tenant ID' })
  @ApiQuery({
    name: 'sourceType',
    required: false,
    description: 'Filter by source type',
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    type: Boolean,
    description: 'Filter by active status',
  })
  @ApiResponse({
    status: 200,
    description: 'Return all mappings',
    type: [SourceHierarchyMapping],
  })
  findAll(
    @Query('tenantId') tenantId: string,
    @Query('sourceType') sourceType?: string,
    @Query('isActive') isActive?: string,
  ): Promise<SourceHierarchyMapping[]> {
    const filters: { sourceType?: string; isActive?: boolean } = {};
    if (sourceType) {
      filters.sourceType = sourceType;
    }
    if (isActive !== undefined) {
      filters.isActive = isActive.toLowerCase() === 'true';
    }
    return this.mappingService.findAll(tenantId, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get hierarchy mapping by ID' })
  @ApiResponse({
    status: 200,
    description: 'Return mapping',
    type: SourceHierarchyMapping,
  })
  @ApiResponse({ status: 404, description: 'Mapping not found' })
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<SourceHierarchyMapping> {
    return this.mappingService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update hierarchy mapping' })
  @ApiResponse({
    status: 200,
    description: 'Mapping updated successfully',
    type: SourceHierarchyMapping,
  })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateDto: UpdateSourceHierarchyMappingDto,
  ): Promise<SourceHierarchyMapping> {
    return this.mappingService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete hierarchy mapping' })
  @ApiResponse({ status: 200, description: 'Mapping deleted successfully' })
  remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    return this.mappingService.remove(id);
  }

  @Post('find-mapping')
  @ApiOperation({ summary: 'Find hierarchy mapping for an event' })
  @ApiResponse({
    status: 200,
    description: 'Return hierarchy IDs if mapping found',
    type: HierarchyIds,
  })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async findMapping(
    @Body() request: MappingRequest,
  ): Promise<HierarchyIds | null> {
    return this.mappingService.findHierarchyMapping(request);
  }
}
