import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsDateString, MaxLength } from 'class-validator';

export class CreatePIEventDto {
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

  @ApiProperty({ description: 'Event name', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiProperty({ description: 'Template name', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  template?: string;

  @ApiProperty({ description: 'Primary AF ID', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  primaryAfId?: string;

  @ApiProperty({ description: 'Start time UTC', required: false })
  @IsOptional()
  @IsDateString()
  startUtc?: string;

  @ApiProperty({ description: 'End time UTC', required: false })
  @IsOptional()
  @IsDateString()
  endUtc?: string;

  @ApiProperty({ description: 'Acknowledged', required: false })
  @IsOptional()
  @IsBoolean()
  acknowledged?: boolean;

  @ApiProperty({ description: 'Event data (JSON)', required: false })
  @IsOptional()
  @IsString()
  eventData?: string;
}

