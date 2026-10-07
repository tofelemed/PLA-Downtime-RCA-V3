import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class CreateHistorianTagDto {
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

  @ApiProperty({ description: 'Tag name' })
  @IsString()
  @MaxLength(255)
  tagName: string;

  @ApiProperty({ description: 'Tag path', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  tagPath?: string;

  @ApiProperty({ description: 'Description', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Category', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiProperty({ description: 'Unit of measure', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  unitOfMeasure?: string;

  @ApiProperty({ description: 'Data type', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  dataType?: string;

  @ApiProperty({ description: 'Update interval in seconds', required: false })
  @IsOptional()
  updateInterval?: number;

  @ApiProperty({ description: 'Warning threshold', required: false })
  @IsOptional()
  warningThreshold?: number;

  @ApiProperty({ description: 'Alarm threshold', required: false })
  @IsOptional()
  alarmThreshold?: number;

  @ApiProperty({ description: 'Enabled', required: false })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({ description: 'Additional configuration JSON', required: false })
  @IsOptional()
  config?: Record<string, any>;
}

