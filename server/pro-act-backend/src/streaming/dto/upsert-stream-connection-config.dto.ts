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

const CONNECTION_STATUSES = ['connected', 'disconnected', 'connecting', 'error'] as const;

export class UpsertStreamConnectionConfigDto {
  @ApiProperty({ description: 'Unique configuration identifier' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  id: string;

  @ApiProperty({ description: 'Configuration name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ description: 'Connection type (modbus, mqtt, websocket, etc.)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  type: string;

  @ApiProperty({ description: 'Connection configuration payload', required: false, type: Object })
  @IsOptional()
  config?: Record<string, any>;

  @ApiProperty({ description: 'Whether the connection is enabled', default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean = true;

  @ApiProperty({ description: 'Timestamp of last connection attempt', required: false })
  @IsOptional()
  @IsDateString()
  lastConnection?: string;

  @ApiProperty({ description: 'Current connection status', enum: CONNECTION_STATUSES, default: 'disconnected' })
  @IsOptional()
  @IsString()
  @IsIn(CONNECTION_STATUSES)
  connectionStatus?: typeof CONNECTION_STATUSES[number] = 'disconnected';

  @ApiProperty({ description: 'Error count for the connection', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  errorCount?: number = 0;

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


