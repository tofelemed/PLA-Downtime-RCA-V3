import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, MaxLength, IsObject } from 'class-validator';

export class CreateRCAAnalysisConfigDto {
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

  @ApiProperty({ description: 'Configuration name' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ description: 'Configuration description', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Whether this configuration is active', required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ description: 'Enabled analysis tools', required: false })
  @IsOptional()
  @IsObject()
  enabledTools?: Record<string, boolean>;

  @ApiProperty({ description: 'Five Why configuration', required: false })
  @IsOptional()
  @IsObject()
  fiveWhyConfig?: Record<string, any>;

  @ApiProperty({ description: 'Fishbone configuration', required: false })
  @IsOptional()
  @IsObject()
  fishboneConfig?: Record<string, any>;

  @ApiProperty({ description: 'FMEA configuration', required: false })
  @IsOptional()
  @IsObject()
  fmeaConfig?: Record<string, any>;

  @ApiProperty({ description: 'Fault tree configuration', required: false })
  @IsOptional()
  @IsObject()
  faultTreeConfig?: Record<string, any>;

  @ApiProperty({ description: 'Knowledge base configuration', required: false })
  @IsOptional()
  @IsObject()
  knowledgeBaseConfig?: Record<string, any>;

  @ApiProperty({ description: 'Required field configuration', required: false })
  @IsOptional()
  @IsObject()
  requiredFields?: Record<string, any>;
}

