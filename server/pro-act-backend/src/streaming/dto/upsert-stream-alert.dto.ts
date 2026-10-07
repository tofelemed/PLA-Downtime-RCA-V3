import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const ALERT_TYPES = ['warning', 'error', 'critical', 'info'] as const;

export class UpsertStreamAlertDto {
  @ApiProperty({ description: 'Unique alert identifier' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  id: string;

  @ApiProperty({ description: 'Alert classification', enum: ALERT_TYPES })
  @IsString()
  @IsIn(ALERT_TYPES)
  type: typeof ALERT_TYPES[number];

  @ApiProperty({ description: 'Alert message' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({ description: 'Alert timestamp' })
  @IsDateString()
  timestamp: string;

  @ApiProperty({ description: 'Source identifier of the alert' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  source: string;

  @ApiProperty({ description: 'Severity score (1-10)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  severity?: number = 1;

  @ApiProperty({ description: 'Whether the alert has been acknowledged', default: false })
  @IsOptional()
  @IsBoolean()
  acknowledged?: boolean = false;

  @ApiProperty({ description: 'Additional metadata', required: false, type: Object })
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Tenant identifier', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  tenantId?: string;

  @ApiProperty({ description: 'Organization identifier', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  organizationId?: string;
}


