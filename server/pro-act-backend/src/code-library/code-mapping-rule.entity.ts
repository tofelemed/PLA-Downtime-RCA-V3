import { Column, Entity, Index, Unique } from 'typeorm';
import { TenantScopedEntity } from '../common/entities/tenant-scoped.entity';
import {
  CODE_MAPPING_RULE_KINDS,
  CodeMappingRuleKind,
} from './code-library-kind';

/**
 * Versioned default rules between code libraries (spec §3.2, §14.2 `code_mapping_rules`): reason →
 * OEE component / schedule class / impact code, impact → valuation (cost per hour). Rows are append-only:
 * a new rule for the same (kind, source code) is the next `version`; the rule effective at an instant is
 * the highest version whose `effective_from` is not after it, so history never changes (T18).
 */
@Entity('code_mapping_rules')
@Unique('UQ_code_mapping_rules_tenant_kind_source_version', [
  'tenantId',
  'ruleKind',
  'sourceCodeId',
  'version',
])
@Index('IDX_code_mapping_rules_tenant_source', ['tenantId', 'sourceCodeId'])
export class CodeMappingRule extends TenantScopedEntity {
  @Column({
    name: 'rule_kind',
    type: 'enum',
    enum: CODE_MAPPING_RULE_KINDS,
    enumName: 'code_mapping_rule_kind',
  })
  ruleKind: CodeMappingRuleKind;

  /** reason code id (reason_* kinds) or impact code id (impact_to_valuation) */
  @Column({ name: 'source_code_id', type: 'uuid' })
  sourceCodeId: string;

  /** OEE component, schedule class, or a decimal cost per hour */
  @Column({
    name: 'target_value',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  targetValue: string | null;

  /** impact code id (reason_to_impact) */
  @Column({ name: 'target_code_id', type: 'uuid', nullable: true })
  targetCodeId: string | null;

  @Column({ name: 'version', type: 'int' })
  version: number;

  @Column({ name: 'effective_from', type: 'timestamptz' })
  effectiveFrom: Date;

  @Column({ name: 'effective_to', type: 'timestamptz', nullable: true })
  effectiveTo: Date | null;
}
