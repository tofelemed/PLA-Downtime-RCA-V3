import { IsString, IsOptional, IsNumber, IsBoolean, IsUUID, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEtherNetIPConnectionDto {
  @ApiProperty({ description: 'Connection name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Connection description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'IP address of the EtherNet/IP device' })
  @IsString()
  ipAddress: string;

  @ApiPropertyOptional({ description: 'Port number', default: 44818 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(65535)
  port?: number;

  @ApiPropertyOptional({ description: 'Connection timeout in milliseconds', default: 10000 })
  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(60000)
  timeoutMs?: number;

  @ApiPropertyOptional({ description: 'Retry count', default: 3 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  retryCount?: number;

  @ApiPropertyOptional({ description: 'Backplane slot number', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(31)
  backplaneSlot?: number;

  @ApiPropertyOptional({ description: 'CIP Security enabled', default: false })
  @IsOptional()
  @IsBoolean()
  cipSecurity?: boolean;

  @ApiPropertyOptional({ description: 'Vendor ID', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(65535)
  vendorId?: number;

  @ApiPropertyOptional({ description: 'Product code', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(65535)
  productCode?: number;

  @ApiPropertyOptional({ description: 'Polling interval in milliseconds', default: 100 })
  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(10000)
  pollingIntervalMs?: number;

  @ApiPropertyOptional({ description: 'CIP tag paths (JSON array)' })
  @IsOptional()
  @IsString()
  tagPaths?: string;

  @ApiPropertyOptional({ description: 'Data types for tags (JSON array)' })
  @IsOptional()
  @IsString()
  dataTypes?: string;

  @ApiPropertyOptional({ description: 'Array sizes for tags (JSON array)' })
  @IsOptional()
  @IsString()
  arraySizes?: string;

  @ApiPropertyOptional({ description: 'Whether the connection is enabled', default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({ description: 'Tenant ID' })
  @IsUUID()
  tenantId: string;

  @ApiPropertyOptional({ description: 'Organization ID' })
  @IsOptional()
  @IsUUID()
  organizationId?: string;
}

export class UpdateEtherNetIPConnectionDto {
  @ApiPropertyOptional({ description: 'Connection name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Connection description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'IP address of the EtherNet/IP device' })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiPropertyOptional({ description: 'Port number' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(65535)
  port?: number;

  @ApiPropertyOptional({ description: 'Connection timeout in milliseconds' })
  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(60000)
  timeoutMs?: number;

  @ApiPropertyOptional({ description: 'Retry count' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  retryCount?: number;

  @ApiPropertyOptional({ description: 'Backplane slot number' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(31)
  backplaneSlot?: number;

  @ApiPropertyOptional({ description: 'CIP Security enabled' })
  @IsOptional()
  @IsBoolean()
  cipSecurity?: boolean;

  @ApiPropertyOptional({ description: 'Vendor ID' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(65535)
  vendorId?: number;

  @ApiPropertyOptional({ description: 'Product code' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(65535)
  productCode?: number;

  @ApiPropertyOptional({ description: 'Polling interval in milliseconds' })
  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(10000)
  pollingIntervalMs?: number;

  @ApiPropertyOptional({ description: 'CIP tag paths (JSON array)' })
  @IsOptional()
  @IsString()
  tagPaths?: string;

  @ApiPropertyOptional({ description: 'Data types for tags (JSON array)' })
  @IsOptional()
  @IsString()
  dataTypes?: string;

  @ApiPropertyOptional({ description: 'Array sizes for tags (JSON array)' })
  @IsOptional()
  @IsString()
  arraySizes?: string;

  @ApiPropertyOptional({ description: 'Whether the connection is enabled' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Organization ID' })
  @IsOptional()
  @IsUUID()
  organizationId?: string;
}

export class TestEtherNetIPConnectionDto {
  @ApiPropertyOptional({ description: 'Override IP address for testing' })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiPropertyOptional({ description: 'Override port for testing' })
  @IsOptional()
  @IsNumber()
  port?: number;

  @ApiPropertyOptional({ description: 'Override backplane slot for testing' })
  @IsOptional()
  @IsNumber()
  backplaneSlot?: number;

  @ApiPropertyOptional({ description: 'Override vendor ID for testing' })
  @IsOptional()
  @IsNumber()
  vendorId?: number;

  @ApiPropertyOptional({ description: 'Override product code for testing' })
  @IsOptional()
  @IsNumber()
  productCode?: number;
}
