import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsInt, MaxLength, IsArray } from 'class-validator';

export class CreateCustomAttributeDefinitionDto {
  @ApiProperty({ description: 'Tenant ID', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  tenantId?: string;

  @ApiProperty({ description: 'Organization ID', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  organizationId?: string;

  @ApiProperty({ description: 'Entity type' })
  @IsString()
  @MaxLength(100)
  entityType: string;

  @ApiProperty({ description: 'Attribute name' })
  @IsString()
  @MaxLength(255)
  attributeName: string;

  @ApiProperty({ description: 'Display name', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  displayName?: string;

  @ApiProperty({ description: 'Description', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Data type', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  dataType?: string;

  @ApiProperty({ description: 'Is required', required: false })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiProperty({ description: 'Default value', required: false })
  @IsOptional()
  @IsString()
  defaultValue?: string;

  @ApiProperty({ description: 'Validation rules (JSON)', required: false })
  @IsOptional()
  validationRules?: Record<string, any>;

  @ApiProperty({ description: 'Select options for select data type', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectOptions?: string[];

  @ApiProperty({ description: 'Display order', required: false })
  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @ApiProperty({ description: 'Is active', required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ description: 'Created by user', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  createdBy?: string;
}

