import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsNumber,
  IsEnum,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import {
  SourceType,
  TargetType,
} from '../entities/source-hierarchy-mapping.entity';

export class CreateSourceHierarchyMappingDto {
  @ApiProperty({
    description:
      'Source type (PI, OPCUA, Modbus, MQTT, etc.) or "*" for all sources',
    enum: [
      'PI',
      'OPCUA',
      'Modbus',
      'MQTT',
      'Database',
      'RESTAPI',
      'SystemIntegration',
      '*',
    ],
  })
  @IsEnum([
    'PI',
    'OPCUA',
    'Modbus',
    'MQTT',
    'Database',
    'RESTAPI',
    'SystemIntegration',
    '*',
  ])
  sourceType: SourceType;

  @ApiPropertyOptional({ description: 'Optional: specific connection ID' })
  @IsOptional()
  @IsUUID()
  sourceConnectionId?: string;

  @ApiProperty({
    description:
      'External source identifier (WebId, NodeId, Topic, Register, etc.)',
  })
  @IsString()
  @MaxLength(1000)
  sourceIdentifier: string;

  @ApiPropertyOptional({
    description: 'Optional: hierarchical path in source system',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  sourcePath?: string;

  @ApiProperty({
    description: 'Target hierarchy level (unit, asset, tenant, organization)',
    enum: ['unit', 'asset', 'tenant', 'organization'],
  })
  @IsEnum(['unit', 'asset', 'tenant', 'organization'])
  targetType: TargetType;

  @ApiProperty({
    description:
      'Target hierarchy ID (Unit ID, Asset ID, Tenant ID, or Organization ID)',
  })
  @IsUUID()
  targetId: string;

  @ApiProperty({ description: 'Tenant ID for multi-tenancy' })
  @IsUUID()
  @MaxLength(36)
  tenantId: string;

  @ApiPropertyOptional({ description: 'Organization ID' })
  @IsOptional()
  @IsUUID()
  @MaxLength(36)
  organizationId?: string;

  @ApiPropertyOptional({
    description: 'Is this a pattern rule?',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isPattern?: boolean;

  @ApiPropertyOptional({
    description: 'Pattern expression (e.g., "PI\\\\Plant1\\\\Line1\\\\*")',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  pattern?: string;

  @ApiPropertyOptional({
    description: 'Priority for matching (higher = checked first)',
    default: 50,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  priority?: number;

  @ApiPropertyOptional({
    description: 'Is this mapping active?',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Description of this mapping' })
  @IsOptional()
  @IsString()
  description?: string;
}
