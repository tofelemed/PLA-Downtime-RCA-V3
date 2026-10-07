import { IsString, IsNumber, IsBoolean, IsOptional, IsUUID, IsIn, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSCADAConnectionDto {
  @ApiProperty({ description: 'Connection name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Connection description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'IP address of the SCADA device' })
  @IsString()
  ipAddress: string;

  @ApiPropertyOptional({ description: 'Port number', default: 502 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(65535)
  port?: number;

  @ApiPropertyOptional({ description: 'Protocol type', default: 'modbus' })
  @IsOptional()
  @IsString()
  @IsIn(['modbus', 'opcua', 'dnp3', 'iec61850'])
  protocol?: string;

  @ApiPropertyOptional({ description: 'Connection type', default: 'tcp' })
  @IsOptional()
  @IsString()
  @IsIn(['tcp', 'rtu', 'ascii'])
  connectionType?: string;

  @ApiPropertyOptional({ description: 'Unit ID', default: 1 })
  @IsOptional()
  @IsNumber()
  unitId?: number;

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
  @IsIn(['read', 'write', 'monitor'])
  operationType?: string;

  @ApiPropertyOptional({ description: 'Register type' })
  @IsOptional()
  @IsString()
  @IsIn(['coil', 'discrete', 'holding', 'input'])
  registerType?: string;

  @ApiPropertyOptional({ description: 'Start address' })
  @IsOptional()
  @IsNumber()
  startAddress?: number;

  @ApiPropertyOptional({ description: 'Register count' })
  @IsOptional()
  @IsNumber()
  registerCount?: number;

  @ApiPropertyOptional({ description: 'Data type', default: 'uint16' })
  @IsOptional()
  @IsString()
  @IsIn(['uint16', 'int16', 'uint32', 'int32', 'float', 'double'])
  dataType?: string;

  @ApiPropertyOptional({ description: 'Enable connection', default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({ description: 'Tenant ID' })
  @IsUUID()
  tenantId: string;
}

export class UpdateSCADAConnectionDto {
  @ApiPropertyOptional({ description: 'Connection name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Connection description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'IP address of the SCADA device' })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiPropertyOptional({ description: 'Port number' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(65535)
  port?: number;

  @ApiPropertyOptional({ description: 'Protocol type' })
  @IsOptional()
  @IsString()
  @IsIn(['modbus', 'opcua', 'dnp3', 'iec61850'])
  protocol?: string;

  @ApiPropertyOptional({ description: 'Connection type' })
  @IsOptional()
  @IsString()
  @IsIn(['tcp', 'rtu', 'ascii'])
  connectionType?: string;

  @ApiPropertyOptional({ description: 'Unit ID' })
  @IsOptional()
  @IsNumber()
  unitId?: number;

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
  @IsIn(['read', 'write', 'monitor'])
  operationType?: string;

  @ApiPropertyOptional({ description: 'Register type' })
  @IsOptional()
  @IsString()
  @IsIn(['coil', 'discrete', 'holding', 'input'])
  registerType?: string;

  @ApiPropertyOptional({ description: 'Start address' })
  @IsOptional()
  @IsNumber()
  startAddress?: number;

  @ApiPropertyOptional({ description: 'Register count' })
  @IsOptional()
  @IsNumber()
  registerCount?: number;

  @ApiPropertyOptional({ description: 'Data type' })
  @IsOptional()
  @IsString()
  @IsIn(['uint16', 'int16', 'uint32', 'int32', 'float', 'double'])
  dataType?: string;

  @ApiPropertyOptional({ description: 'Enable connection' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class TestSCADAConnectionDto {
  @ApiProperty({ description: 'IP address to test' })
  @IsString()
  ipAddress: string;

  @ApiPropertyOptional({ description: 'Port to test', default: 502 })
  @IsOptional()
  @IsNumber()
  port?: number;

  @ApiPropertyOptional({ description: 'Protocol to test', default: 'modbus' })
  @IsOptional()
  @IsString()
  @IsIn(['modbus', 'opcua', 'dnp3', 'iec61850'])
  protocol?: string;

  @ApiPropertyOptional({ description: 'Unit ID to test', default: 1 })
  @IsOptional()
  @IsNumber()
  unitId?: number;

  @ApiPropertyOptional({ description: 'Timeout in milliseconds', default: 10000 })
  @IsOptional()
  @IsNumber()
  timeoutMs?: number;
}
