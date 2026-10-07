import { IsString, IsNumber, IsBoolean, IsOptional, IsUUID, IsIn, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBACnetConnectionDto {
  @ApiProperty({ description: 'Connection name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Connection description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'IP address of the BACnet device' })
  @IsString()
  ipAddress: string;

  @ApiPropertyOptional({ description: 'Port number', default: 47808 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(65535)
  port?: number;

  @ApiPropertyOptional({ description: 'Device ID', default: 123 })
  @IsOptional()
  @IsNumber()
  deviceId?: number;

  @ApiPropertyOptional({ description: 'Timeout in milliseconds', default: 10000 })
  @IsOptional()
  @IsNumber()
  timeoutMs?: number;

  @ApiPropertyOptional({ description: 'Retry count', default: 3 })
  @IsOptional()
  @IsNumber()
  retryCount?: number;

  @ApiPropertyOptional({ description: 'Polling interval in milliseconds', default: 1000 })
  @IsOptional()
  @IsNumber()
  pollingIntervalMs?: number;

  @ApiPropertyOptional({ description: 'Operation type', default: 'readProperty' })
  @IsOptional()
  @IsString()
  @IsIn(['readProperty', 'writeProperty', 'subscribeCOV'])
  operationType?: string;

  @ApiPropertyOptional({ description: 'Object type' })
  @IsOptional()
  @IsString()
  objectType?: string;

  @ApiPropertyOptional({ description: 'Object instance' })
  @IsOptional()
  @IsNumber()
  objectInstance?: number;

  @ApiPropertyOptional({ description: 'Property ID' })
  @IsOptional()
  @IsString()
  propertyId?: string;

  @ApiPropertyOptional({ description: 'Enable connection', default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({ description: 'Tenant ID' })
  @IsUUID()
  tenantId: string;
}

export class UpdateBACnetConnectionDto {
  @ApiPropertyOptional({ description: 'Connection name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Connection description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'IP address of the BACnet device' })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiPropertyOptional({ description: 'Port number' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(65535)
  port?: number;

  @ApiPropertyOptional({ description: 'Device ID' })
  @IsOptional()
  @IsNumber()
  deviceId?: number;

  @ApiPropertyOptional({ description: 'Timeout in milliseconds' })
  @IsOptional()
  @IsNumber()
  timeoutMs?: number;

  @ApiPropertyOptional({ description: 'Retry count' })
  @IsOptional()
  @IsNumber()
  retryCount?: number;

  @ApiPropertyOptional({ description: 'Polling interval in milliseconds' })
  @IsOptional()
  @IsNumber()
  pollingIntervalMs?: number;

  @ApiPropertyOptional({ description: 'Operation type' })
  @IsOptional()
  @IsString()
  @IsIn(['readProperty', 'writeProperty', 'subscribeCOV'])
  operationType?: string;

  @ApiPropertyOptional({ description: 'Object type' })
  @IsOptional()
  @IsString()
  objectType?: string;

  @ApiPropertyOptional({ description: 'Object instance' })
  @IsOptional()
  @IsNumber()
  objectInstance?: number;

  @ApiPropertyOptional({ description: 'Property ID' })
  @IsOptional()
  @IsString()
  propertyId?: string;

  @ApiPropertyOptional({ description: 'Enable connection' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class TestBACnetConnectionDto {
  @ApiProperty({ description: 'IP address to test' })
  @IsString()
  ipAddress: string;

  @ApiPropertyOptional({ description: 'Port to test', default: 47808 })
  @IsOptional()
  @IsNumber()
  port?: number;

  @ApiPropertyOptional({ description: 'Device ID to test', default: 123 })
  @IsOptional()
  @IsNumber()
  deviceId?: number;

  @ApiPropertyOptional({ description: 'Timeout in milliseconds', default: 10000 })
  @IsOptional()
  @IsNumber()
  timeoutMs?: number;
}
