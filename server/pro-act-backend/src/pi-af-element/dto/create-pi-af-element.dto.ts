import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, MaxLength, IsInt } from 'class-validator';

export class CreatePIAfElementDto {
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

  @ApiProperty({ description: 'PI Web ID', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  webId?: string;

  @ApiProperty({ description: 'Element name', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiProperty({ description: 'Description', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Element path', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  path?: string;

  @ApiProperty({ description: 'Template name', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  template?: string;

  @ApiProperty({ description: 'Categories (JSON string)', required: false })
  @IsOptional()
  @IsString()
  categories?: string;

  @ApiProperty({ description: 'Parent element ID', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  parentId?: string;

  @ApiProperty({ description: 'Hierarchy level', required: false })
  @IsOptional()
  @IsInt()
  hierarchyLevel?: number;

  @ApiProperty({ description: 'Last seen timestamp', required: false })
  @IsOptional()
  @IsString()
  lastSeenAt?: string;

  @ApiProperty({ description: 'Has children', required: false })
  @IsOptional()
  @IsBoolean()
  hasChildren?: boolean;

  @ApiProperty({ description: 'Additional metadata (JSON string)', required: false })
  @IsOptional()
  @IsString()
  metadata?: string;
}

