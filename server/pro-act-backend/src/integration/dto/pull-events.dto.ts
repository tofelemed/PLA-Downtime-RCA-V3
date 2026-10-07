import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsNumber, IsIn, MaxLength } from 'class-validator';

export class PullEventsDto {
  @ApiProperty({ description: 'Tenant ID' })
  @IsString()
  @MaxLength(36)
  tenantId: string;

  @ApiProperty({ description: 'Start time (ISO 8601 UTC)', required: false })
  @IsOptional()
  @IsString()
  startTimeUtc?: string;

  @ApiProperty({ description: 'End time (ISO 8601 UTC)', required: false })
  @IsOptional()
  @IsString()
  endTimeUtc?: string;

  @ApiProperty({ description: 'Scope type', enum: ['database', 'element'], required: false })
  @IsOptional()
  @IsIn(['database', 'element'])
  scopeType?: 'database' | 'element';

  @ApiProperty({ description: 'Scope ID (database WebId or element WebId)', required: false })
  @IsOptional()
  @IsString()
  scopeId?: string;

  @ApiProperty({ description: 'Template name filter', required: false })
  @IsOptional()
  @IsString()
  templateName?: string;

  @ApiProperty({ description: 'Maximum number of events to fetch', required: false, default: 200 })
  @IsOptional()
  @IsNumber()
  maxCount?: number;

  @ApiProperty({ description: 'Automatically create production events', required: false, default: true })
  @IsOptional()
  @IsBoolean()
  autoCreateProductionEvents?: boolean;
}

