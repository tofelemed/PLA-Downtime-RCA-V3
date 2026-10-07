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

export class UpsertStreamDataSinkDto {
  @ApiProperty({ description: 'Unique identifier for the sink' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  id: string;

  @ApiProperty({ description: 'Display name of the sink' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ description: 'Sink type (database, api, websocket, etc.)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  type: string;

  @ApiProperty({ description: 'Configuration payload', required: false, type: Object })
  @IsOptional()
  config?: Record<string, any>;

  @ApiProperty({ description: 'Whether the sink is enabled', default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean = true;

  @ApiProperty({ description: 'Last write timestamp', required: false })
  @IsOptional()
  @IsDateString()
  lastWrite?: string;

  @ApiProperty({ description: 'Total write count', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  writeCount?: number = 0;

  @ApiProperty({ description: 'Total error count', default: 0 })
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


