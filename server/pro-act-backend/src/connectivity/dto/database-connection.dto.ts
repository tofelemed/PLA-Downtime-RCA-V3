import { IsString, IsNumber, IsBoolean, IsOptional, IsUUID, IsIn, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDatabaseConnectionDto {
  @ApiProperty({ description: 'Connection name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Connection description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Database type' })
  @IsString()
  @IsIn(['postgresql', 'mysql', 'mssql', 'oracle', 'sqlite', 'mongodb', 'influxdb', 'redis'])
  databaseType: string;

  @ApiProperty({ description: 'Host address' })
  @IsString()
  host: string;

  @ApiPropertyOptional({ description: 'Port number', default: 5432 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(65535)
  port?: number;

  @ApiProperty({ description: 'Database name' })
  @IsString()
  database: string;

  @ApiPropertyOptional({ description: 'Username' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ description: 'Password' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ description: 'Schema name' })
  @IsOptional()
  @IsString()
  schema?: string;

  @ApiPropertyOptional({ description: 'Table name' })
  @IsOptional()
  @IsString()
  table?: string;

  @ApiPropertyOptional({ description: 'Timeout in milliseconds', default: 30000 })
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

  @ApiPropertyOptional({ description: 'Operation type', default: 'query' })
  @IsOptional()
  @IsString()
  @IsIn(['query', 'insert', 'update', 'delete', 'subscribe'])
  operationType?: string;

  @ApiPropertyOptional({ description: 'SQL query' })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiPropertyOptional({ description: 'Connection string' })
  @IsOptional()
  @IsString()
  connectionString?: string;

  @ApiPropertyOptional({ description: 'Enable connection', default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({ description: 'Tenant ID' })
  @IsUUID()
  tenantId: string;
}

export class UpdateDatabaseConnectionDto {
  @ApiPropertyOptional({ description: 'Connection name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Connection description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Database type' })
  @IsOptional()
  @IsString()
  @IsIn(['postgresql', 'mysql', 'mssql', 'oracle', 'sqlite', 'mongodb', 'influxdb', 'redis'])
  databaseType?: string;

  @ApiPropertyOptional({ description: 'Host address' })
  @IsOptional()
  @IsString()
  host?: string;

  @ApiPropertyOptional({ description: 'Port number' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(65535)
  port?: number;

  @ApiPropertyOptional({ description: 'Database name' })
  @IsOptional()
  @IsString()
  database?: string;

  @ApiPropertyOptional({ description: 'Username' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ description: 'Password' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ description: 'Schema name' })
  @IsOptional()
  @IsString()
  schema?: string;

  @ApiPropertyOptional({ description: 'Table name' })
  @IsOptional()
  @IsString()
  table?: string;

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
  @IsIn(['query', 'insert', 'update', 'delete', 'subscribe'])
  operationType?: string;

  @ApiPropertyOptional({ description: 'SQL query' })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiPropertyOptional({ description: 'Connection string' })
  @IsOptional()
  @IsString()
  connectionString?: string;

  @ApiPropertyOptional({ description: 'Enable connection' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class TestDatabaseConnectionDto {
  @ApiProperty({ description: 'Database type to test' })
  @IsString()
  @IsIn(['postgresql', 'mysql', 'mssql', 'oracle', 'sqlite', 'mongodb', 'influxdb', 'redis'])
  databaseType: string;

  @ApiProperty({ description: 'Host address to test' })
  @IsString()
  host: string;

  @ApiPropertyOptional({ description: 'Port to test' })
  @IsOptional()
  @IsNumber()
  port?: number;

  @ApiProperty({ description: 'Database name to test' })
  @IsString()
  database: string;

  @ApiPropertyOptional({ description: 'Username to test' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ description: 'Password to test' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ description: 'Connection string to test' })
  @IsOptional()
  @IsString()
  connectionString?: string;

  @ApiPropertyOptional({ description: 'Timeout in milliseconds', default: 30000 })
  @IsOptional()
  @IsNumber()
  timeoutMs?: number;
}
