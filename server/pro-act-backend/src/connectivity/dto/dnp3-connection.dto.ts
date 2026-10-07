import { IsString, IsNumber, IsBoolean, IsOptional, IsUUID, IsIn, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDNP3ConnectionDto {
  @ApiProperty({ description: 'Connection name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Connection description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'IP address of the DNP3 device' })
  @IsString()
  ipAddress: string;

  @ApiPropertyOptional({ description: 'Port number', default: 20000 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(65535)
  port?: number;

  @ApiPropertyOptional({ description: 'Connection type', default: 'tcp' })
  @IsOptional()
  @IsString()
  @IsIn(['tcp', 'serial'])
  connectionType?: string;

  @ApiPropertyOptional({ description: 'Source address', default: 1 })
  @IsOptional()
  @IsNumber()
  sourceAddress?: number;

  @ApiPropertyOptional({ description: 'Destination address', default: 1 })
  @IsOptional()
  @IsNumber()
  destinationAddress?: number;

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

  @ApiPropertyOptional({ description: 'Operation type', default: 'read' })
  @IsOptional()
  @IsString()
  @IsIn(['read', 'write', 'control'])
  operationType?: string;

  @ApiPropertyOptional({ description: 'Object group' })
  @IsOptional()
  @IsString()
  objectGroup?: string;

  @ApiPropertyOptional({ description: 'Object variation' })
  @IsOptional()
  @IsNumber()
  objectVariation?: number;

  @ApiPropertyOptional({ description: 'Start index' })
  @IsOptional()
  @IsNumber()
  startIndex?: number;

  @ApiPropertyOptional({ description: 'Stop index' })
  @IsOptional()
  @IsNumber()
  stopIndex?: number;

  @ApiPropertyOptional({ description: 'Enable connection', default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({ description: 'Tenant ID' })
  @IsUUID()
  tenantId: string;
}

export class UpdateDNP3ConnectionDto {
  @ApiPropertyOptional({ description: 'Connection name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Connection description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'IP address of the DNP3 device' })
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
  @IsIn(['tcp', 'serial'])
  connectionType?: string;

  @ApiPropertyOptional({ description: 'Source address' })
  @IsOptional()
  @IsNumber()
  sourceAddress?: number;

  @ApiPropertyOptional({ description: 'Destination address' })
  @IsOptional()
  @IsNumber()
  destinationAddress?: number;

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
  @IsIn(['read', 'write', 'control'])
  operationType?: string;

  @ApiPropertyOptional({ description: 'Object group' })
  @IsOptional()
  @IsString()
  objectGroup?: string;

  @ApiPropertyOptional({ description: 'Object variation' })
  @IsOptional()
  @IsNumber()
  objectVariation?: number;

  @ApiPropertyOptional({ description: 'Start index' })
  @IsOptional()
  @IsNumber()
  startIndex?: number;

  @ApiPropertyOptional({ description: 'Stop index' })
  @IsOptional()
  @IsNumber()
  stopIndex?: number;

  @ApiPropertyOptional({ description: 'Enable connection' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class TestDNP3ConnectionDto {
  @ApiProperty({ description: 'IP address to test' })
  @IsString()
  ipAddress: string;

  @ApiPropertyOptional({ description: 'Port to test', default: 20000 })
  @IsOptional()
  @IsNumber()
  port?: number;

  @ApiPropertyOptional({ description: 'Source address to test', default: 1 })
  @IsOptional()
  @IsNumber()
  sourceAddress?: number;

  @ApiPropertyOptional({ description: 'Destination address to test', default: 1 })
  @IsOptional()
  @IsNumber()
  destinationAddress?: number;

  @ApiPropertyOptional({ description: 'Timeout in milliseconds', default: 10000 })
  @IsOptional()
  @IsNumber()
  timeoutMs?: number;
}
