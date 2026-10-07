import { IsString, IsNumber, IsBoolean, IsOptional, IsUUID, IsIn, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProfinetConnectionDto {
  @ApiProperty({ description: 'Connection name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Connection description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'IP address of the Profinet device' })
  @IsString()
  ipAddress: string;

  @ApiPropertyOptional({ description: 'Port number', default: 34964 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(65535)
  port?: number;

  @ApiPropertyOptional({ description: 'Connection type', default: 'tcp' })
  @IsOptional()
  @IsString()
  @IsIn(['tcp', 'udp'])
  connectionType?: string;

  @ApiPropertyOptional({ description: 'Device ID', default: 1 })
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

  @ApiPropertyOptional({ description: 'Polling interval in milliseconds', default: 100 })
  @IsOptional()
  @IsNumber()
  pollingIntervalMs?: number;

  @ApiPropertyOptional({ description: 'Operation type', default: 'read' })
  @IsOptional()
  @IsString()
  @IsIn(['read', 'write', 'subscribe'])
  operationType?: string;

  @ApiPropertyOptional({ description: 'Slot number' })
  @IsOptional()
  @IsString()
  slotNumber?: string;

  @ApiPropertyOptional({ description: 'Subslot number' })
  @IsOptional()
  @IsString()
  subslotNumber?: string;

  @ApiPropertyOptional({ description: 'Index' })
  @IsOptional()
  @IsString()
  index?: string;

  @ApiPropertyOptional({ description: 'Subindex' })
  @IsOptional()
  @IsString()
  subindex?: string;

  @ApiPropertyOptional({ description: 'Enable connection', default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({ description: 'Tenant ID' })
  @IsUUID()
  tenantId: string;
}

export class UpdateProfinetConnectionDto {
  @ApiPropertyOptional({ description: 'Connection name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Connection description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'IP address of the Profinet device' })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiPropertyOptional({ description: 'Port number' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(65535)
  port?: number;

  @ApiPropertyOptional({ description: 'Connection type' })
  @IsOptional()
  @IsString()
  @IsIn(['tcp', 'udp'])
  connectionType?: string;

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
  @IsIn(['read', 'write', 'subscribe'])
  operationType?: string;

  @ApiPropertyOptional({ description: 'Slot number' })
  @IsOptional()
  @IsString()
  slotNumber?: string;

  @ApiPropertyOptional({ description: 'Subslot number' })
  @IsOptional()
  @IsString()
  subslotNumber?: string;

  @ApiPropertyOptional({ description: 'Index' })
  @IsOptional()
  @IsString()
  index?: string;

  @ApiPropertyOptional({ description: 'Subindex' })
  @IsOptional()
  @IsString()
  subindex?: string;

  @ApiPropertyOptional({ description: 'Enable connection' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class TestProfinetConnectionDto {
  @ApiProperty({ description: 'IP address to test' })
  @IsString()
  ipAddress: string;

  @ApiPropertyOptional({ description: 'Port to test', default: 34964 })
  @IsOptional()
  @IsNumber()
  port?: number;

  @ApiPropertyOptional({ description: 'Device ID to test', default: 1 })
  @IsOptional()
  @IsNumber()
  deviceId?: number;

  @ApiPropertyOptional({ description: 'Timeout in milliseconds', default: 10000 })
  @IsOptional()
  @IsNumber()
  timeoutMs?: number;
}
