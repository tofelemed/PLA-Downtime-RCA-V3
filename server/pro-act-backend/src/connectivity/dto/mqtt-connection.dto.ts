import { IsString, IsOptional, IsNumber, IsBoolean, IsUUID, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMQTTConnectionDto {
  @ApiProperty({ description: 'Connection name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Connection description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'MQTT broker URL' })
  @IsString()
  brokerUrl: string;

  @ApiPropertyOptional({ description: 'Port number', default: 1883 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(65535)
  port?: number;

  @ApiPropertyOptional({ description: 'Client ID' })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ description: 'Username for authentication' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ description: 'Password for authentication' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ description: 'Keep alive interval in seconds', default: 60 })
  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(3600)
  keepAliveSeconds?: number;

  @ApiPropertyOptional({ description: 'Reconnect period in milliseconds', default: 1000 })
  @IsOptional()
  @IsNumber()
  @Min(100)
  @Max(60000)
  reconnectPeriodMs?: number;

  @ApiPropertyOptional({ description: 'Connect timeout in milliseconds', default: 30000 })
  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(120000)
  connectTimeoutMs?: number;

  @ApiPropertyOptional({ description: 'Clean session flag', default: true })
  @IsOptional()
  @IsBoolean()
  cleanSession?: boolean;

  @ApiPropertyOptional({ description: 'Subscribe topics (comma-separated)' })
  @IsOptional()
  @IsString()
  subscribeTopics?: string;

  @ApiPropertyOptional({ description: 'Default publish topic' })
  @IsOptional()
  @IsString()
  publishTopic?: string;

  @ApiPropertyOptional({ description: 'Quality of Service level', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  qosLevel?: number;

  @ApiPropertyOptional({ description: 'Use TLS encryption', default: false })
  @IsOptional()
  @IsBoolean()
  useTLS?: boolean;

  @ApiPropertyOptional({ description: 'CA certificate for TLS' })
  @IsOptional()
  @IsString()
  caCert?: string;

  @ApiPropertyOptional({ description: 'Client certificate for TLS' })
  @IsOptional()
  @IsString()
  clientCert?: string;

  @ApiPropertyOptional({ description: 'Client key for TLS' })
  @IsOptional()
  @IsString()
  clientKey?: string;

  @ApiPropertyOptional({ description: 'Last will topic' })
  @IsOptional()
  @IsString()
  lastWillTopic?: string;

  @ApiPropertyOptional({ description: 'Last will message' })
  @IsOptional()
  @IsString()
  lastWillMessage?: string;

  @ApiPropertyOptional({ description: 'Last will QoS level', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  lastWillQos?: number;

  @ApiPropertyOptional({ description: 'Last will retain flag', default: false })
  @IsOptional()
  @IsBoolean()
  lastWillRetain?: boolean;

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

export class UpdateMQTTConnectionDto {
  @ApiPropertyOptional({ description: 'Connection name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Connection description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'MQTT broker URL' })
  @IsOptional()
  @IsString()
  brokerUrl?: string;

  @ApiPropertyOptional({ description: 'Port number' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(65535)
  port?: number;

  @ApiPropertyOptional({ description: 'Client ID' })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ description: 'Username for authentication' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ description: 'Password for authentication' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ description: 'Keep alive interval in seconds' })
  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(3600)
  keepAliveSeconds?: number;

  @ApiPropertyOptional({ description: 'Reconnect period in milliseconds' })
  @IsOptional()
  @IsNumber()
  @Min(100)
  @Max(60000)
  reconnectPeriodMs?: number;

  @ApiPropertyOptional({ description: 'Connect timeout in milliseconds' })
  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(120000)
  connectTimeoutMs?: number;

  @ApiPropertyOptional({ description: 'Clean session flag' })
  @IsOptional()
  @IsBoolean()
  cleanSession?: boolean;

  @ApiPropertyOptional({ description: 'Subscribe topics (comma-separated)' })
  @IsOptional()
  @IsString()
  subscribeTopics?: string;

  @ApiPropertyOptional({ description: 'Default publish topic' })
  @IsOptional()
  @IsString()
  publishTopic?: string;

  @ApiPropertyOptional({ description: 'Quality of Service level' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  qosLevel?: number;

  @ApiPropertyOptional({ description: 'Use TLS encryption' })
  @IsOptional()
  @IsBoolean()
  useTLS?: boolean;

  @ApiPropertyOptional({ description: 'CA certificate for TLS' })
  @IsOptional()
  @IsString()
  caCert?: string;

  @ApiPropertyOptional({ description: 'Client certificate for TLS' })
  @IsOptional()
  @IsString()
  clientCert?: string;

  @ApiPropertyOptional({ description: 'Client key for TLS' })
  @IsOptional()
  @IsString()
  clientKey?: string;

  @ApiPropertyOptional({ description: 'Last will topic' })
  @IsOptional()
  @IsString()
  lastWillTopic?: string;

  @ApiPropertyOptional({ description: 'Last will message' })
  @IsOptional()
  @IsString()
  lastWillMessage?: string;

  @ApiPropertyOptional({ description: 'Last will QoS level' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  lastWillQos?: number;

  @ApiPropertyOptional({ description: 'Last will retain flag' })
  @IsOptional()
  @IsBoolean()
  lastWillRetain?: boolean;

  @ApiPropertyOptional({ description: 'Whether the connection is enabled' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Organization ID' })
  @IsOptional()
  @IsUUID()
  organizationId?: string;
}

export class TestMQTTConnectionDto {
  @ApiPropertyOptional({ description: 'Override broker URL for testing' })
  @IsOptional()
  @IsString()
  brokerUrl?: string;

  @ApiPropertyOptional({ description: 'Override port for testing' })
  @IsOptional()
  @IsNumber()
  port?: number;

  @ApiPropertyOptional({ description: 'Override username for testing' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ description: 'Override password for testing' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ description: 'Override client ID for testing' })
  @IsOptional()
  @IsString()
  clientId?: string;
}
