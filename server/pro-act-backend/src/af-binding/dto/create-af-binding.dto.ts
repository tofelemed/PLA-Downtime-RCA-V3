import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class CreateAfBindingDto {
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

  @ApiProperty({ description: 'Local entity ID', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  localId?: string;

  @ApiProperty({ description: 'Bound type', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  boundType?: string;

  @ApiProperty({ description: 'Mapping config (JSON)', required: false })
  @IsOptional()
  @IsString()
  mappingConfig?: string;

  @ApiProperty({ description: 'Is active', required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

