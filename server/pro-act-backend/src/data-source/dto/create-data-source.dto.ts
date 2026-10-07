import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsDateString, MaxLength } from 'class-validator';

export class CreateDataSourceDto {
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

  @ApiProperty({ description: 'Source name' })
  @IsString()
  @MaxLength(255)
  sourceName: string;

  @ApiProperty({ description: 'Source type', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  type?: string;

  @ApiProperty({ description: 'Connection string', required: false })
  @IsOptional()
  @IsString()
  connectionString?: string;

  @ApiProperty({ description: 'Encrypted credentials', required: false })
  @IsOptional()
  @IsString()
  credentialsEncrypted?: string;

  @ApiProperty({ description: 'Status', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;

  @ApiProperty({ description: 'Enabled', required: false })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({ description: 'Last sync time', required: false })
  @IsOptional()
  @IsDateString()
  lastSyncTime?: string;

  @ApiProperty({ description: 'Config (JSON)', required: false })
  @IsOptional()
  @IsString()
  config?: string;
}

