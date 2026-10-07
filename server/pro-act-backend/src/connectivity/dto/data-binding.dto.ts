import { IsString, IsOptional, IsNumber, IsBoolean, IsUUID, IsIn, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDataBindingDto {
  @ApiProperty({ description: 'Binding name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Binding description' })
  @IsOptional()
  @IsString()
  description?: string;

  // Source connection references (only one should be set)
  @ApiPropertyOptional({ description: 'Source OPC UA connection ID' })
  @IsOptional()
  @IsUUID()
  sourceOPCUAConnectionId?: string;

  @ApiPropertyOptional({ description: 'Source Modbus connection ID' })
  @IsOptional()
  @IsUUID()
  sourceModbusConnectionId?: string;

  @ApiPropertyOptional({ description: 'Source EtherNet/IP connection ID' })
  @IsOptional()
  @IsUUID()
  sourceEtherNetIPConnectionId?: string;

  @ApiPropertyOptional({ description: 'Source MQTT connection ID' })
  @IsOptional()
  @IsUUID()
  sourceMQTTConnectionId?: string;

  @ApiPropertyOptional({ description: 'Source system integration ID' })
  @IsOptional()
  @IsUUID()
  sourceSystemIntegrationId?: string;

  // Target connection references (only one should be set)
  @ApiPropertyOptional({ description: 'Target OPC UA connection ID' })
  @IsOptional()
  @IsUUID()
  targetOPCUAConnectionId?: string;

  @ApiPropertyOptional({ description: 'Target Modbus connection ID' })
  @IsOptional()
  @IsUUID()
  targetModbusConnectionId?: string;

  @ApiPropertyOptional({ description: 'Target EtherNet/IP connection ID' })
  @IsOptional()
  @IsUUID()
  targetEtherNetIPConnectionId?: string;

  @ApiPropertyOptional({ description: 'Target MQTT connection ID' })
  @IsOptional()
  @IsUUID()
  targetMQTTConnectionId?: string;

  @ApiPropertyOptional({ description: 'Target system integration ID' })
  @IsOptional()
  @IsUUID()
  targetSystemIntegrationId?: string;

  @ApiPropertyOptional({ description: 'Source data path' })
  @IsOptional()
  @IsString()
  sourcePath?: string;

  @ApiPropertyOptional({ description: 'Target data path' })
  @IsOptional()
  @IsString()
  targetPath?: string;

  @ApiPropertyOptional({ description: 'Transformation rules (JSON)' })
  @IsOptional()
  @IsObject()
  transformationRules?: any;

  @ApiPropertyOptional({ description: 'Polling interval in milliseconds', default: 1000 })
  @IsOptional()
  @IsNumber()
  pollingIntervalMs?: number;

  @ApiPropertyOptional({ description: 'Whether the binding is enabled', default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Whether the binding is active', default: false })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ description: 'Trigger mode', enum: ['manual', 'scheduled', 'event-driven'], default: 'manual' })
  @IsOptional()
  @IsIn(['manual', 'scheduled', 'event-driven'])
  triggerMode?: string;

  @ApiPropertyOptional({ description: 'Schedule configuration (JSON)' })
  @IsOptional()
  @IsObject()
  schedule?: any;

  @ApiPropertyOptional({ description: 'Data filtering rules (JSON)' })
  @IsOptional()
  @IsObject()
  filters?: any;

  @ApiProperty({ description: 'Tenant ID' })
  @IsUUID()
  tenantId: string;
}

export class UpdateDataBindingDto {
  @ApiPropertyOptional({ description: 'Binding name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Binding description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Source data path' })
  @IsOptional()
  @IsString()
  sourcePath?: string;

  @ApiPropertyOptional({ description: 'Target data path' })
  @IsOptional()
  @IsString()
  targetPath?: string;

  @ApiPropertyOptional({ description: 'Transformation rules (JSON)' })
  @IsOptional()
  @IsObject()
  transformationRules?: any;

  @ApiPropertyOptional({ description: 'Polling interval in milliseconds' })
  @IsOptional()
  @IsNumber()
  pollingIntervalMs?: number;

  @ApiPropertyOptional({ description: 'Whether the binding is enabled' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Whether the binding is active' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ description: 'Trigger mode' })
  @IsOptional()
  @IsIn(['manual', 'scheduled', 'event-driven'])
  triggerMode?: string;

  @ApiPropertyOptional({ description: 'Schedule configuration (JSON)' })
  @IsOptional()
  @IsObject()
  schedule?: any;

  @ApiPropertyOptional({ description: 'Data filtering rules (JSON)' })
  @IsOptional()
  @IsObject()
  filters?: any;
}

export class ActivateDataBindingDto {
  @ApiPropertyOptional({ description: 'Activation options' })
  @IsOptional()
  @IsObject()
  options?: any;
}

export class DeactivateDataBindingDto {
  @ApiPropertyOptional({ description: 'Deactivation options' })
  @IsOptional()
  @IsObject()
  options?: any;
}
