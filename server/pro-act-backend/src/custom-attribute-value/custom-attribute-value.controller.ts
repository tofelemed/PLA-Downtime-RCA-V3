import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CustomAttributeValueService } from './custom-attribute-value.service';
import { CreateCustomAttributeValueDto } from './dto/create-custom-attribute-value.dto';
import { UpdateCustomAttributeValueDto } from './dto/update-custom-attribute-value.dto';
import { CustomAttributeValue } from './custom-attribute-value.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Custom Attribute Values')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('custom-attribute-values')
export class CustomAttributeValueController {
  constructor(private readonly customAttributeValueService: CustomAttributeValueService) {}

  @Post()
  @ApiOperation({ summary: 'Create custom attribute value' })
  @ApiResponse({ status: 201, description: 'Value created successfully', type: CustomAttributeValue })
  create(@Body() createDto: CreateCustomAttributeValueDto): Promise<CustomAttributeValue> {
    return this.customAttributeValueService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all custom attribute values' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'organizationId', required: false })
  @ApiQuery({ name: 'entityId', required: false })
  @ApiQuery({ name: 'entityType', required: false })
  @ApiQuery({ name: 'attributeDefinitionId', required: false })
  @ApiResponse({ status: 200, description: 'Return all values', type: [CustomAttributeValue] })
  findAll(
    @Query('tenantId') tenantId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('entityId') entityId?: string,
    @Query('entityType') entityType?: string,
    @Query('attributeDefinitionId') attributeDefinitionId?: string,
  ): Promise<CustomAttributeValue[]> {
    return this.customAttributeValueService.findAll({ tenantId, organizationId, entityId, entityType, attributeDefinitionId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get custom attribute value by ID' })
  @ApiResponse({ status: 200, description: 'Return value', type: CustomAttributeValue })
  findOne(@Param('id') id: string): Promise<CustomAttributeValue> {
    return this.customAttributeValueService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update custom attribute value' })
  @ApiResponse({ status: 200, description: 'Value updated successfully', type: CustomAttributeValue })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateCustomAttributeValueDto,
  ): Promise<CustomAttributeValue> {
    return this.customAttributeValueService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete custom attribute value' })
  @ApiResponse({ status: 204, description: 'Value deleted successfully' })
  remove(@Param('id') id: string): Promise<void> {
    return this.customAttributeValueService.remove(id);
  }
}

