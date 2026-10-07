import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateCustomAttributeValueDto {
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

  @ApiProperty({ description: 'Entity ID' })
  @IsString()
  @MaxLength(36)
  entityId: string;

  @ApiProperty({ description: 'Entity type' })
  @IsString()
  @MaxLength(100)
  entityType: string;

  @ApiProperty({ description: 'Attribute definition ID' })
  @IsString()
  @MaxLength(36)
  attributeDefinitionId: string;

  @ApiProperty({ description: 'Attribute value', required: false })
  @IsOptional()
  @IsString()
  value?: string;
}

