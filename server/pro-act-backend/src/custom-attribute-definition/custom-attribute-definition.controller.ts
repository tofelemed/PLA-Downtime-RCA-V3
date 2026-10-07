import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CustomAttributeDefinitionService } from './custom-attribute-definition.service';
import { CreateCustomAttributeDefinitionDto } from './dto/create-custom-attribute-definition.dto';
import { UpdateCustomAttributeDefinitionDto } from './dto/update-custom-attribute-definition.dto';
import { CustomAttributeDefinition } from './custom-attribute-definition.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Custom Attribute Definitions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('custom-attribute-definitions')
export class CustomAttributeDefinitionController {
  constructor(private readonly customAttributeDefinitionService: CustomAttributeDefinitionService) {}

  @Post()
  @ApiOperation({ summary: 'Create custom attribute definition' })
  @ApiResponse({ status: 201, description: 'Definition created successfully', type: CustomAttributeDefinition })
  create(@Body() createDto: CreateCustomAttributeDefinitionDto): Promise<CustomAttributeDefinition> {
    return this.customAttributeDefinitionService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all custom attribute definitions' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'organizationId', required: false })
  @ApiQuery({ name: 'entityType', required: false })
  @ApiResponse({ status: 200, description: 'Return all definitions', type: [CustomAttributeDefinition] })
  findAll(
    @Query('tenantId') tenantId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('entityType') entityType?: string,
  ): Promise<CustomAttributeDefinition[]> {
    return this.customAttributeDefinitionService.findAll({ tenantId, organizationId, entityType });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get custom attribute definition by ID' })
  @ApiResponse({ status: 200, description: 'Return definition', type: CustomAttributeDefinition })
  findOne(@Param('id') id: string): Promise<CustomAttributeDefinition> {
    return this.customAttributeDefinitionService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update custom attribute definition' })
  @ApiResponse({ status: 200, description: 'Definition updated successfully', type: CustomAttributeDefinition })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateCustomAttributeDefinitionDto,
  ): Promise<CustomAttributeDefinition> {
    return this.customAttributeDefinitionService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete custom attribute definition' })
  @ApiResponse({ status: 204, description: 'Definition deleted successfully' })
  remove(@Param('id') id: string): Promise<void> {
    return this.customAttributeDefinitionService.remove(id);
  }
}

