import { IsString, IsOptional, IsNumber, IsBoolean, IsUUID, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSystemIntegrationDto {
  @ApiProperty({ description: 'Integration name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Integration type', enum: ['PI', 'CMMS', 'Historian', 'Database', 'API'] })
  @IsIn(['PI', 'CMMS', 'Historian', 'Database', 'API'])
  integrationType: string;

  @ApiPropertyOptional({ description: 'API endpoint URL' })
  @IsOptional()
  @IsString()
  endpoint?: string;

  @ApiPropertyOptional({ description: 'API key for authentication' })
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiPropertyOptional({ description: 'Username for authentication' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ description: 'Password for authentication' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ description: 'System type (e.g., SAP, Maximo, Infor)' })
  @IsOptional()
  @IsString()
  systemType?: string;

  @ApiPropertyOptional({ description: 'Database name or identifier' })
  @IsOptional()
  @IsString()
  database?: string;

  @ApiPropertyOptional({ description: 'Synchronization interval in seconds', default: 300 })
  @IsOptional()
  @IsNumber()
  syncIntervalSeconds?: number;

  @ApiPropertyOptional({ description: 'Whether the integration is enabled', default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Additional configuration (JSON)' })
  @IsOptional()
  configuration?: any;

  @ApiPropertyOptional({ description: 'Authentication configuration (JSON)' })
  @IsOptional()
  authentication?: any;

  @ApiPropertyOptional({ description: 'Integration description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Tenant ID' })
  @IsUUID()
  tenantId: string;
}

export class UpdateSystemIntegrationDto {
  @ApiPropertyOptional({ description: 'Integration name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'API endpoint URL' })
  @IsOptional()
  @IsString()
  endpoint?: string;

  @ApiPropertyOptional({ description: 'API key for authentication' })
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiPropertyOptional({ description: 'Username for authentication' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ description: 'Password for authentication' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ description: 'System type (e.g., SAP, Maximo, Infor)' })
  @IsOptional()
  @IsString()
  systemType?: string;

  @ApiPropertyOptional({ description: 'Database name or identifier' })
  @IsOptional()
  @IsString()
  database?: string;

  @ApiPropertyOptional({ description: 'Synchronization interval in seconds' })
  @IsOptional()
  @IsNumber()
  syncIntervalSeconds?: number;

  @ApiPropertyOptional({ description: 'Whether the integration is enabled' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Additional configuration (JSON)' })
  @IsOptional()
  configuration?: any;

  @ApiPropertyOptional({ description: 'Authentication configuration (JSON)' })
  @IsOptional()
  authentication?: any;

  @ApiPropertyOptional({ description: 'Integration description' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class TestSystemIntegrationDto {
  @ApiPropertyOptional({ description: 'Override endpoint for testing' })
  @IsOptional()
  @IsString()
  endpoint?: string;

  @ApiPropertyOptional({ description: 'Override API key for testing' })
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiPropertyOptional({ description: 'Override username for testing' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ description: 'Override password for testing' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ description: 'Override database for testing' })
  @IsOptional()
  @IsString()
  database?: string;
}

export class SyncSystemIntegrationDto {
  @ApiPropertyOptional({ description: 'Force full synchronization' })
  @IsOptional()
  @IsBoolean()
  forceFullSync?: boolean;

  @ApiPropertyOptional({ description: 'Synchronization options' })
  @IsOptional()
  syncOptions?: any;
}
