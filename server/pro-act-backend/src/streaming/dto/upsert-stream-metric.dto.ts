import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpsertStreamMetricDto {
  @ApiProperty({ description: 'Unique metric identifier' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  id: string;

  @ApiProperty({ description: 'Metric timestamp' })
  @IsDateString()
  timestamp: string;

  @ApiProperty({ description: 'Total events processed', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  totalEvents?: number = 0;

  @ApiProperty({ description: 'Successfully processed events', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  processedEvents?: number = 0;

  @ApiProperty({ description: 'Dropped events', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  droppedEvents?: number = 0;

  @ApiProperty({ description: 'Average latency in milliseconds', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  averageLatency?: number = 0;

  @ApiProperty({ description: 'Events processed per second', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  throughput?: number = 0;

  @ApiProperty({ description: 'Active sources count', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  activeSources?: number = 0;

  @ApiProperty({ description: 'Active sinks count', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  activeSinks?: number = 0;

  @ApiProperty({ description: 'Active processors count', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  activeProcessors?: number = 0;

  @ApiProperty({ description: 'Error rate percentage', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  errorRate?: number = 0;

  @ApiProperty({ description: 'Data quality metrics', required: false, type: Object })
  @IsOptional()
  dataQuality?: Record<string, any>;

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


