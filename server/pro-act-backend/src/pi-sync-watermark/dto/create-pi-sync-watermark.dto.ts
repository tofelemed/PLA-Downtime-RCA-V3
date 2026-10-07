import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString, MaxLength } from 'class-validator';

export class CreatePISyncWatermarkDto {
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

  @ApiProperty({ description: 'Sync type', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  syncType?: string;

  @ApiProperty({ description: 'Last sync timestamp', required: false })
  @IsOptional()
  @IsDateString()
  lastSyncTimestamp?: string;

  @ApiProperty({ description: 'Last sync marker', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  lastSyncMarker?: string;

  @ApiProperty({ description: 'Sync status', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  syncStatus?: string;
}

