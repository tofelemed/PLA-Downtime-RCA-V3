import { IsString, IsNumber, IsBoolean, IsOptional, IsUUID, IsIn, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWebSocketConnectionDto {
  @ApiProperty({ description: 'Connection name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Connection description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'WebSocket URL' })
  @IsString()
  url: string;

  @ApiPropertyOptional({ description: 'Protocol', default: 'ws' })
  @IsOptional()
  @IsString()
  @IsIn(['ws', 'wss'])
  protocol?: string;

  @ApiPropertyOptional({ description: 'Subprotocol' })
  @IsOptional()
  @IsString()
  subprotocol?: string;

  @ApiPropertyOptional({ description: 'Timeout in milliseconds', default: 30000 })
  @IsOptional()
  @IsNumber()
  timeoutMs?: number;

  @ApiPropertyOptional({ description: 'Retry count', default: 3 })
  @IsOptional()
  @IsNumber()
  retryCount?: number;

  @ApiPropertyOptional({ description: 'Reconnect interval in milliseconds', default: 5000 })
  @IsOptional()
  @IsNumber()
  reconnectIntervalMs?: number;

  @ApiPropertyOptional({ description: 'Operation type', default: 'connect' })
  @IsOptional()
  @IsString()
  @IsIn(['connect', 'subscribe', 'publish'])
  operationType?: string;

  @ApiPropertyOptional({ description: 'Message handlers (JSON string)' })
  @IsOptional()
  @IsString()
  messageHandlers?: string;

  @ApiPropertyOptional({ description: 'Event handlers (JSON string)' })
  @IsOptional()
  @IsString()
  eventHandlers?: string;

  @ApiPropertyOptional({ description: 'Auto reconnect', default: true })
  @IsOptional()
  @IsBoolean()
  autoReconnect?: boolean;

  @ApiPropertyOptional({ description: 'Enable connection', default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({ description: 'Tenant ID' })
  @IsUUID()
  tenantId: string;
}

export class UpdateWebSocketConnectionDto {
  @ApiPropertyOptional({ description: 'Connection name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Connection description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'WebSocket URL' })
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional({ description: 'Protocol' })
  @IsOptional()
  @IsString()
  @IsIn(['ws', 'wss'])
  protocol?: string;

  @ApiPropertyOptional({ description: 'Subprotocol' })
  @IsOptional()
  @IsString()
  subprotocol?: string;

  @ApiPropertyOptional({ description: 'Timeout in milliseconds' })
  @IsOptional()
  @IsNumber()
  timeoutMs?: number;

  @ApiPropertyOptional({ description: 'Retry count' })
  @IsOptional()
  @IsNumber()
  retryCount?: number;

  @ApiPropertyOptional({ description: 'Reconnect interval in milliseconds' })
  @IsOptional()
  @IsNumber()
  reconnectIntervalMs?: number;

  @ApiPropertyOptional({ description: 'Operation type' })
  @IsOptional()
  @IsString()
  @IsIn(['connect', 'subscribe', 'publish'])
  operationType?: string;

  @ApiPropertyOptional({ description: 'Message handlers (JSON string)' })
  @IsOptional()
  @IsString()
  messageHandlers?: string;

  @ApiPropertyOptional({ description: 'Event handlers (JSON string)' })
  @IsOptional()
  @IsString()
  eventHandlers?: string;

  @ApiPropertyOptional({ description: 'Auto reconnect' })
  @IsOptional()
  @IsBoolean()
  autoReconnect?: boolean;

  @ApiPropertyOptional({ description: 'Enable connection' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class TestWebSocketConnectionDto {
  @ApiProperty({ description: 'URL to test' })
  @IsString()
  url: string;

  @ApiPropertyOptional({ description: 'Protocol to test', default: 'ws' })
  @IsOptional()
  @IsString()
  @IsIn(['ws', 'wss'])
  protocol?: string;

  @ApiPropertyOptional({ description: 'Subprotocol to test' })
  @IsOptional()
  @IsString()
  subprotocol?: string;

  @ApiPropertyOptional({ description: 'Timeout in milliseconds', default: 30000 })
  @IsOptional()
  @IsNumber()
  timeoutMs?: number;
}
