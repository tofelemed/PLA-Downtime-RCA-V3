import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpsertStreamDataSourceDto {
  @ApiProperty({ description: 'Unique identifier for the data source' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  id: string;

  @ApiProperty({ description: 'Display name for the data source' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ description: 'Connector type (ModbusConnector, MQTTConnector, etc.)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  connectorType: string;

  @ApiProperty({ description: 'Connector configuration payload', required: false, type: Object })
  @IsOptional()
  config?: Record<string, any>;

  @ApiProperty({ description: 'Whether the data source is enabled', default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean = true;

  @ApiProperty({ description: 'Last payload received from the source', required: false, type: Object })
  @IsOptional()
  lastData?: Record<string, any>;

  @ApiProperty({ description: 'Timestamp of the last update', required: false })
  @IsOptional()
  @IsDateString()
  lastUpdate?: string;

  @ApiProperty({ description: 'Number of errors encountered', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  errorCount?: number = 0;

  @ApiProperty({ description: 'Status of the data source', default: 'inactive' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string = 'inactive';

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


