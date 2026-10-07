import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class CreatePIMappingDto {
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

  @ApiProperty({ description: 'Source type', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sourceType?: string;

  @ApiProperty({ description: 'Source ID', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  sourceId?: string;

  @ApiProperty({ description: 'Target type', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  targetType?: string;

  @ApiProperty({ description: 'Target ID', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  targetId?: string;

  @ApiProperty({ description: 'Mapping rules (JSON)', required: false })
  @IsOptional()
  @IsString()
  mappingRules?: string;

  @ApiProperty({ description: 'Is active', required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

