import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  MaxLength,
  IsArray,
  ValidateNested,
  IsNumber,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  RCATriggerAPMType,
  RCATriggerEventType,
  RCATriggerQualityResult,
  RCATriggerSeverity,
  RCATriggerSOLType,
  RCATriggerStatus,
} from '../rca-trigger-config.entity';

class TriggerRuleConditionsDto {
  @ApiProperty({
    description: 'Severities included in rule',
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsIn(['Critical', 'High', 'Medium', 'Low'], { each: true })
  severities?: RCATriggerSeverity[];

  @ApiProperty({
    description: 'Minimum cost threshold in USD',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  minCost?: number;

  @ApiProperty({
    description: 'Minimum duration threshold in minutes',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  minDuration?: number;

  @ApiProperty({
    description: 'Statuses that trigger RCA',
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsIn(['Open', 'In Progress', 'Closed', 'Cancelled'], { each: true })
  statuses?: RCATriggerStatus[];

  @ApiProperty({
    description: 'Impact code categories',
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  impactCategories?: string[];

  @ApiProperty({
    description: 'OEE code categories',
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  oeeCategories?: string[];

  @ApiProperty({
    description: 'Require impact code to be present',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  requiresImpactCode?: boolean;

  @ApiProperty({
    description: 'Require OEE code to be present',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  requiresOEECode?: boolean;

  @ApiProperty({
    description: 'Quality results (for IOW)',
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsIn(['Pass', 'Fail'], { each: true })
  qualityResults?: RCATriggerQualityResult[];

  @ApiProperty({
    description: 'APM types (for APM events)',
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsIn(['Health', 'Prediction', 'Alert'], { each: true })
  apmTypes?: RCATriggerAPMType[];

  @ApiProperty({
    description: 'SOL types (for SOL events)',
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsIn(['Safety', 'Operational'], { each: true })
  solTypes?: RCATriggerSOLType[];
}

class RCATriggerRuleDto {
  @ApiProperty({ description: 'Rule ID', required: false })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ description: 'Rule name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Rule description', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Event type the rule applies to' })
  @IsIn([
    'ProductionLoss',
    'IOW',
    'SOL',
    'APM',
    'FailureWO',
    'ProductionOutput',
    'All',
  ])
  eventType: RCATriggerEventType;

  @ApiProperty({
    description: 'Is the rule enabled',
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({
    description: 'Rule conditions',
    type: TriggerRuleConditionsDto,
  })
  @ValidateNested()
  @Type(() => TriggerRuleConditionsDto)
  conditions: TriggerRuleConditionsDto;

  @ApiProperty({
    description: 'Rule evaluation priority (higher first)',
    required: false,
    default: 50,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  priority?: number;

  @ApiProperty({ description: 'Rule creation timestamp', required: false })
  @IsOptional()
  @IsString()
  createdAt?: string;

  @ApiProperty({ description: 'Rule last update timestamp', required: false })
  @IsOptional()
  @IsString()
  updatedAt?: string;

  @ApiProperty({ description: 'Tenant ID', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  tenantId?: string;

  @ApiProperty({ description: 'Organization ID', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  organizationId?: string;
}

class RCATriggerGlobalSettingsDto {
  @ApiProperty({
    description: 'Allow manual RCA creation even if no rules match',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  alwaysAllowManualCreation?: boolean;

  @ApiProperty({
    description: 'Show warning for low impact events',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  showWarningForLowImpact?: boolean;

  @ApiProperty({
    description: 'Require approval for low impact events',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  requireApprovalForLowImpact?: boolean;

  @ApiProperty({
    description: 'Global minimum cost threshold',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  minCostThresholdGlobal?: number;

  @ApiProperty({
    description: 'Global minimum duration threshold',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  minDurationThresholdGlobal?: number;
}

export class CreateRCATriggerConfigDto {
  @ApiProperty({ description: 'Tenant ID', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  tenantId?: string;

  @ApiProperty({ description: 'Organization ID', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  organizationId?: string;

  @ApiProperty({ description: 'Trigger configuration name' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ description: 'Description', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Advanced trigger rules',
    type: [RCATriggerRuleDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RCATriggerRuleDto)
  rules?: RCATriggerRuleDto[];

  @ApiProperty({
    description: 'Global trigger settings',
    required: false,
    type: RCATriggerGlobalSettingsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => RCATriggerGlobalSettingsDto)
  globalSettings?: RCATriggerGlobalSettingsDto;

  @ApiProperty({ description: 'Is active', required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    description: 'Automatically create RCA when triggered',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  autoCreateRca?: boolean;

  @ApiProperty({ description: 'Legacy trigger type', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  triggerType?: string;

  @ApiProperty({
    description: 'Legacy trigger conditions JSON',
    required: false,
  })
  @IsOptional()
  @IsString()
  legacyConditions?: string;
}
