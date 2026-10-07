import { IsString, IsNumber, IsBoolean, IsOptional, IsUUID, IsIn, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRestApiConnectionDto {
  @ApiProperty({ description: 'Connection name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Connection description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Base URL' })
  @IsString()
  baseUrl: string;

  @ApiPropertyOptional({ description: 'Protocol', default: 'https' })
  @IsOptional()
  @IsString()
  @IsIn(['http', 'https'])
  protocol?: string;

  @ApiPropertyOptional({ description: 'Default HTTP method', default: 'GET' })
  @IsOptional()
  @IsString()
  @IsIn(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'])
  defaultMethod?: string;

  @ApiPropertyOptional({ description: 'Username' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ description: 'Password' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ description: 'API Key' })
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiPropertyOptional({ description: 'Authentication type', default: 'none' })
  @IsOptional()
  @IsString()
  @IsIn(['none', 'basic', 'bearer', 'apikey'])
  authType?: string;

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

  @ApiPropertyOptional({ description: 'Operation type', default: 'request' })
  @IsOptional()
  @IsString()
  @IsIn(['request', 'poll', 'webhook'])
  operationType?: string;

  @ApiPropertyOptional({ description: 'Headers (JSON string)' })
  @IsOptional()
  @IsString()
  headers?: string;

  @ApiPropertyOptional({ description: 'Query parameters (JSON string)' })
  @IsOptional()
  @IsString()
  queryParams?: string;

  @ApiPropertyOptional({ description: 'Enable connection', default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({ description: 'Tenant ID' })
  @IsUUID()
  tenantId: string;
}

export class UpdateRestApiConnectionDto {
  @ApiPropertyOptional({ description: 'Connection name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Connection description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Base URL' })
  @IsOptional()
  @IsString()
  baseUrl?: string;

  @ApiPropertyOptional({ description: 'Protocol' })
  @IsOptional()
  @IsString()
  @IsIn(['http', 'https'])
  protocol?: string;

  @ApiPropertyOptional({ description: 'Default HTTP method' })
  @IsOptional()
  @IsString()
  @IsIn(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'])
  defaultMethod?: string;

  @ApiPropertyOptional({ description: 'Username' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ description: 'Password' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ description: 'API Key' })
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiPropertyOptional({ description: 'Authentication type' })
  @IsOptional()
  @IsString()
  @IsIn(['none', 'basic', 'bearer', 'apikey'])
  authType?: string;

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
  @IsIn(['request', 'poll', 'webhook'])
  operationType?: string;

  @ApiPropertyOptional({ description: 'Headers (JSON string)' })
  @IsOptional()
  @IsString()
  headers?: string;

  @ApiPropertyOptional({ description: 'Query parameters (JSON string)' })
  @IsOptional()
  @IsString()
  queryParams?: string;

  @ApiPropertyOptional({ description: 'Enable connection' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class TestRestApiConnectionDto {
  @ApiProperty({ description: 'Base URL to test' })
  @IsString()
  baseUrl: string;

  @ApiPropertyOptional({ description: 'HTTP method to test', default: 'GET' })
  @IsOptional()
  @IsString()
  @IsIn(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'])
  method?: string;

  @ApiPropertyOptional({ description: 'Username to test' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ description: 'Password to test' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ description: 'API Key to test' })
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiPropertyOptional({ description: 'Timeout in milliseconds', default: 30000 })
  @IsOptional()
  @IsNumber()
  timeoutMs?: number;
}
