import { IsString, IsOptional, IsNumber, IsBoolean, IsUUID, Min, Max, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOPCUAConnectionDto {
  @ApiProperty({ description: 'Connection name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Connection description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'OPC UA server endpoint' })
  @IsString()
  endpoint: string;

  @ApiPropertyOptional({ description: 'Security mode', default: 'SignAndEncrypt' })
  @IsOptional()
  @IsString()
  securityMode?: string;

  @ApiPropertyOptional({ description: 'Security policy', default: 'Basic256Sha256' })
  @IsOptional()
  @IsString()
  securityPolicy?: string;

  @ApiPropertyOptional({ description: 'Authentication type', enum: ['Anonymous', 'Username', 'Certificate'], default: 'Anonymous' })
  @IsOptional()
  @IsString()
  @IsIn(['Anonymous', 'Username', 'Certificate'])
  authentication?: string;

  @ApiPropertyOptional({ description: 'Certificate path for certificate authentication' })
  @IsOptional()
  @IsString()
  certificatePath?: string;

  @ApiPropertyOptional({ description: 'Private key path for certificate authentication' })
  @IsOptional()
  @IsString()
  privateKeyPath?: string;

  @ApiPropertyOptional({ description: 'Reconnect interval in milliseconds', default: 5000 })
  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(60000)
  reconnectIntervalMs?: number;

  @ApiPropertyOptional({ description: 'Maximum reconnect attempts', default: 5 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  maxReconnectAttempts?: number;

  @ApiPropertyOptional({ description: 'Username for authentication' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ description: 'Password for authentication' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ description: 'Connection timeout in milliseconds', default: 30000 })
  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(300000)
  timeoutMs?: number;

  @ApiPropertyOptional({ description: 'Session timeout in milliseconds', default: 60000 })
  @IsOptional()
  @IsNumber()
  @Min(10000)
  @Max(600000)
  sessionTimeoutMs?: number;

  @ApiPropertyOptional({ description: 'Keep alive interval in milliseconds', default: 10000 })
  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(60000)
  keepAliveMs?: number;

  @ApiPropertyOptional({ description: 'Maximum message size', default: 65536 })
  @IsOptional()
  @IsNumber()
  @Min(1024)
  @Max(1048576)
  maxMessageSize?: number;

  @ApiPropertyOptional({ description: 'Default polling interval in milliseconds', default: 1000 })
  @IsOptional()
  @IsNumber()
  @Min(100)
  @Max(60000)
  pollingIntervalMs?: number;

  @ApiPropertyOptional({ description: 'Subscription size', default: 1000 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10000)
  subscriptionSize?: number;

  @ApiPropertyOptional({ description: 'Default nodes to poll (comma-separated)' })
  @IsOptional()
  @IsString()
  defaultNodes?: string;

  @ApiPropertyOptional({ description: 'Application name', default: 'ProAct Client' })
  @IsOptional()
  @IsString()
  applicationName?: string;

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

export class UpdateOPCUAConnectionDto {
  @ApiPropertyOptional({ description: 'Connection name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Connection description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'OPC UA server endpoint' })
  @IsOptional()
  @IsString()
  endpoint?: string;

  @ApiPropertyOptional({ description: 'Security mode' })
  @IsOptional()
  @IsString()
  securityMode?: string;

  @ApiPropertyOptional({ description: 'Security policy' })
  @IsOptional()
  @IsString()
  securityPolicy?: string;

  @ApiPropertyOptional({ description: 'Authentication type', enum: ['Anonymous', 'Username', 'Certificate'] })
  @IsOptional()
  @IsString()
  @IsIn(['Anonymous', 'Username', 'Certificate'])
  authentication?: string;

  @ApiPropertyOptional({ description: 'Certificate path' })
  @IsOptional()
  @IsString()
  certificatePath?: string;

  @ApiPropertyOptional({ description: 'Private key path' })
  @IsOptional()
  @IsString()
  privateKeyPath?: string;

  @ApiPropertyOptional({ description: 'Reconnect interval in milliseconds' })
  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(60000)
  reconnectIntervalMs?: number;

  @ApiPropertyOptional({ description: 'Maximum reconnect attempts' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  maxReconnectAttempts?: number;

  @ApiPropertyOptional({ description: 'Username for authentication' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ description: 'Password for authentication' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ description: 'Connection timeout in milliseconds' })
  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(300000)
  timeoutMs?: number;

  @ApiPropertyOptional({ description: 'Session timeout in milliseconds' })
  @IsOptional()
  @IsNumber()
  @Min(10000)
  @Max(600000)
  sessionTimeoutMs?: number;

  @ApiPropertyOptional({ description: 'Keep alive interval in milliseconds' })
  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(60000)
  keepAliveMs?: number;

  @ApiPropertyOptional({ description: 'Maximum message size' })
  @IsOptional()
  @IsNumber()
  @Min(1024)
  @Max(1048576)
  maxMessageSize?: number;

  @ApiPropertyOptional({ description: 'Default polling interval in milliseconds' })
  @IsOptional()
  @IsNumber()
  @Min(100)
  @Max(60000)
  pollingIntervalMs?: number;

  @ApiPropertyOptional({ description: 'Subscription size' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10000)
  subscriptionSize?: number;

  @ApiPropertyOptional({ description: 'Default nodes to poll (comma-separated)' })
  @IsOptional()
  @IsString()
  defaultNodes?: string;

  @ApiPropertyOptional({ description: 'Application name' })
  @IsOptional()
  @IsString()
  applicationName?: string;

  @ApiPropertyOptional({ description: 'Whether the connection is enabled' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Organization ID' })
  @IsOptional()
  @IsUUID()
  organizationId?: string;
}

export class TestOPCUAConnectionDto {
  @ApiPropertyOptional({ description: 'Override endpoint for testing' })
  @IsOptional()
  @IsString()
  endpoint?: string;

  @ApiPropertyOptional({ description: 'Override username for testing' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ description: 'Override password for testing' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ description: 'Override security mode for testing' })
  @IsOptional()
  @IsString()
  securityMode?: string;

  @ApiPropertyOptional({ description: 'Override security policy for testing' })
  @IsOptional()
  @IsString()
  securityPolicy?: string;
}
