import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, IsDateString } from 'class-validator';

export class CreateUnmappedEventDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  tenantId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  organizationId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  unitId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  eventName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  eventType?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  startTime?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  endTime?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  sourceSystem?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  sourceId?: string;

  @ApiPropertyOptional({ description: 'JSON string with reason, suggestions, event snapshot' })
  @IsString()
  @IsOptional()
  eventData?: string;
}
