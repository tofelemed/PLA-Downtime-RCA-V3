import { IsString, IsOptional, IsNumber, IsBoolean, IsUUID, IsIn, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateModbusConnectionDto {
  @ApiProperty({ description: 'Connection name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Connection description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Modbus connection type', enum: ['tcp', 'rtu', 'ascii'] })
  @IsIn(['tcp', 'rtu', 'ascii'])
  connectionType: string;

  @ApiPropertyOptional({ description: 'IP address for TCP connections' })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiPropertyOptional({ description: 'Port for TCP connections' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(65535)
  port?: number;

  @ApiPropertyOptional({ description: 'Serial port for RTU/ASCII connections' })
  @IsOptional()
  @IsString()
  serialPort?: string;

  @ApiPropertyOptional({ description: 'Baud rate for serial connections' })
  @IsOptional()
  @IsNumber()
  baudRate?: number;

  @ApiPropertyOptional({ description: 'Response timeout in milliseconds', default: 5000 })
  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(60000)
  timeoutMs?: number;

  @ApiPropertyOptional({ description: 'Number of retry attempts', default: 3 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  retryCount?: number;

  @ApiPropertyOptional({ description: 'Modbus unit ID', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(255)
  unitId?: number;

  @ApiPropertyOptional({ description: 'Polling interval in milliseconds', default: 1000 })
  @IsOptional()
  @IsNumber()
  @Min(100)
  @Max(60000)
  pollingIntervalMs?: number;

  @ApiPropertyOptional({ description: 'Start address for register reading', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(65535)
  startAddress?: number;

  @ApiPropertyOptional({ description: 'Number of registers to read', default: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(125)
  registerCount?: number;

  @ApiPropertyOptional({ description: 'Data type for register values', default: 'uint16' })
  @IsOptional()
  @IsString()
  dataType?: string;

  @ApiPropertyOptional({ description: 'Byte ordering', default: 'big-endian' })
  @IsOptional()
  @IsString()
  byteOrdering?: string;

  @ApiPropertyOptional({ description: 'Scaling factor for values', default: 1 })
  @IsOptional()
  @IsNumber()
  scalingFactor?: number;

  @ApiPropertyOptional({ description: 'Unit of measurement' })
  @IsOptional()
  @IsString()
  unit?: string;

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

export class UpdateModbusConnectionDto {
  @ApiPropertyOptional({ description: 'Connection name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Connection description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'IP address for TCP connections' })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiPropertyOptional({ description: 'Port for TCP connections' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(65535)
  port?: number;

  @ApiPropertyOptional({ description: 'Serial port for RTU/ASCII connections' })
  @IsOptional()
  @IsString()
  serialPort?: string;

  @ApiPropertyOptional({ description: 'Baud rate for serial connections' })
  @IsOptional()
  @IsNumber()
  baudRate?: number;

  @ApiPropertyOptional({ description: 'Response timeout in milliseconds' })
  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(60000)
  timeoutMs?: number;

  @ApiPropertyOptional({ description: 'Number of retry attempts' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  retryCount?: number;

  @ApiPropertyOptional({ description: 'Modbus unit ID' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(255)
  unitId?: number;

  @ApiPropertyOptional({ description: 'Polling interval in milliseconds' })
  @IsOptional()
  @IsNumber()
  @Min(100)
  @Max(60000)
  pollingIntervalMs?: number;

  @ApiPropertyOptional({ description: 'Start address for register reading' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(65535)
  startAddress?: number;

  @ApiPropertyOptional({ description: 'Number of registers to read' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(125)
  registerCount?: number;

  @ApiPropertyOptional({ description: 'Data type for register values' })
  @IsOptional()
  @IsString()
  dataType?: string;

  @ApiPropertyOptional({ description: 'Byte ordering' })
  @IsOptional()
  @IsString()
  byteOrdering?: string;

  @ApiPropertyOptional({ description: 'Scaling factor for values' })
  @IsOptional()
  @IsNumber()
  scalingFactor?: number;

  @ApiPropertyOptional({ description: 'Unit of measurement' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ description: 'Whether the connection is enabled' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Organization ID' })
  @IsOptional()
  @IsUUID()
  organizationId?: string;
}

export class TestModbusConnectionDto {
  @ApiPropertyOptional({ description: 'Override IP address for testing' })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiPropertyOptional({ description: 'Override port for testing' })
  @IsOptional()
  @IsNumber()
  port?: number;

  @ApiPropertyOptional({ description: 'Override serial port for testing' })
  @IsOptional()
  @IsString()
  serialPort?: string;

  @ApiPropertyOptional({ description: 'Override baud rate for testing' })
  @IsOptional()
  @IsNumber()
  baudRate?: number;

  @ApiPropertyOptional({ description: 'Override unit ID for testing' })
  @IsOptional()
  @IsNumber()
  unitId?: number;
}
