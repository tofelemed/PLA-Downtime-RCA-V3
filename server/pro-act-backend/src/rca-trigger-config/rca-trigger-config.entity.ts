import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export type RCATriggerEventType = 'ProductionLoss' | 'IOW' | 'SOL' | 'APM' | 'FailureWO' | 'ProductionOutput' | 'All';
export type RCATriggerSeverity = 'Critical' | 'High' | 'Medium' | 'Low';
export type RCATriggerStatus = 'Open' | 'In Progress' | 'Closed' | 'Cancelled';
export type RCATriggerQualityResult = 'Pass' | 'Fail';
export type RCATriggerAPMType = 'Health' | 'Prediction' | 'Alert';
export type RCATriggerSOLType = 'Safety' | 'Operational';

export interface RCATriggerRuleConditions {
  severities?: RCATriggerSeverity[];
  minCost?: number;
  minDuration?: number;
  statuses?: RCATriggerStatus[];
  impactCategories?: string[];
  oeeCategories?: string[];
  requiresImpactCode?: boolean;
  requiresOEECode?: boolean;
  qualityResults?: RCATriggerQualityResult[];
  apmTypes?: RCATriggerAPMType[];
  solTypes?: RCATriggerSOLType[];
}

export interface RCATriggerRuleModel {
  id: string;
  name: string;
  description?: string;
  eventType: RCATriggerEventType;
  enabled: boolean;
  conditions: RCATriggerRuleConditions;
  priority: number;
  createdAt: string;
  updatedAt: string;
  tenantId?: string;
  organizationId?: string;
}

export interface RCATriggerGlobalSettings {
  alwaysAllowManualCreation: boolean;
  showWarningForLowImpact: boolean;
  requireApprovalForLowImpact: boolean;
  minCostThresholdGlobal?: number;
  minDurationThresholdGlobal?: number;
}

const jsonArrayTransformer = {
  to: (value: RCATriggerRuleModel[] | null): string | null => {
    if (!value) {
      return JSON.stringify([]);
    }
    return JSON.stringify(value);
  },
  from: (value: string | null): RCATriggerRuleModel[] => {
    if (!value) {
      return [];
    }
    try {
      return JSON.parse(value);
    } catch (error) {
      return [];
    }
  },
};

const jsonObjectTransformer = {
  to: (value: RCATriggerGlobalSettings | null): string | null => {
    if (!value) {
      return JSON.stringify({});
    }
    return JSON.stringify(value);
  },
  from: (value: string | null): RCATriggerGlobalSettings => {
    if (!value) {
      return {
        alwaysAllowManualCreation: true,
        showWarningForLowImpact: true,
        requireApprovalForLowImpact: false,
      };
    }
    try {
      const parsed = JSON.parse(value);
      return {
        alwaysAllowManualCreation: parsed.alwaysAllowManualCreation ?? true,
        showWarningForLowImpact: parsed.showWarningForLowImpact ?? true,
        requireApprovalForLowImpact: parsed.requireApprovalForLowImpact ?? false,
        minCostThresholdGlobal: parsed.minCostThresholdGlobal ?? undefined,
        minDurationThresholdGlobal: parsed.minDurationThresholdGlobal ?? undefined,
      };
    } catch {
      return {
        alwaysAllowManualCreation: true,
        showWarningForLowImpact: true,
        requireApprovalForLowImpact: false,
      };
    }
  },
};

@Entity('rca_trigger_configs')
@Index(['tenantId'])
@Index(['organizationId'])
@Index(['createdAt'])
export class RCATriggerConfig {
  @ApiProperty({ description: 'Primary key UUID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ApiProperty({ description: 'Tenant ID for multi-tenancy', required: false })
  @Column({ name: 'tenant_id', type: 'varchar', length: 36, nullable: true })
  tenantId?: string;

  @ApiProperty({ description: 'Organization ID', required: false })
  @Column({ name: 'organization_id', type: 'varchar', length: 36, nullable: true })
  organizationId?: string;

  @ApiProperty({ description: 'Trigger configuration name' })
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @ApiProperty({ description: 'Description of the trigger', required: false })
  @Column({ type: 'text', nullable: true })
  description?: string;

  @ApiProperty({
    description: 'Advanced trigger rules stored as JSON',
    type: 'array',
    required: false,
    isArray: true,
  })
  @Column({
    name: 'rules',
    type: 'text',
    nullable: true,
    transformer: jsonArrayTransformer,
  })
  rules: RCATriggerRuleModel[];

  @ApiProperty({
    description: 'Global trigger settings overriding rule-level behaviour',
    required: false,
  })
  @Column({
    name: 'global_settings',
    type: 'text',
    nullable: true,
    transformer: jsonObjectTransformer,
  })
  globalSettings: RCATriggerGlobalSettings;

  @ApiProperty({ description: 'Whether this trigger configuration is active' })
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @ApiProperty({ description: 'Automatically create RCA when triggered', required: false })
  @Column({ name: 'auto_create_rca', type: 'boolean', default: false })
  autoCreateRca: boolean;

  @ApiProperty({ description: 'Legacy trigger type', required: false })
  @Column({ name: 'trigger_type', type: 'varchar', length: 100, nullable: true })
  triggerType?: string;

  @ApiProperty({ description: 'Legacy trigger conditions JSON', required: false })
  @Column({ name: 'legacy_conditions', type: 'text', nullable: true })
  legacyConditions?: string;
}

