import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import { RuleDefinition } from '../grammar/rule-definition';
import { Rule } from './rule.entity';

export const RULE_VERSION_ORIGINS = ['activation', 'rollback'] as const;
export type RuleVersionOrigin = (typeof RULE_VERSION_ORIGINS)[number];

/**
 * One approved, immutable version of a rule (plan 3.8): written on activation or rollback, never
 * updated. A rollback copies the definition of an earlier version into a new one, so history only grows.
 */
@Entity('rule_versions')
@Unique('UQ_rule_versions_rule_version', ['ruleId', 'version'])
@Index('IDX_rule_versions_tenant_rule', ['tenantId', 'ruleId'])
export class RuleVersion extends TenantScopedEntity {
  @Column({ name: 'rule_id', type: 'uuid' })
  ruleId: string;

  @ManyToOne(() => Rule, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'rule_id' })
  rule?: Rule;

  @Column({ name: 'version', type: 'int' })
  version: number;

  @Column({ name: 'definition', type: 'jsonb' })
  definition: RuleDefinition;

  @Column({
    name: 'origin',
    type: 'enum',
    enum: RULE_VERSION_ORIGINS,
    enumName: 'rule_version_origin',
  })
  origin: RuleVersionOrigin;

  /** rollback: the version whose definition was restored */
  @Column({ name: 'restored_version', type: 'int', nullable: true })
  restoredVersion: number | null;

  /** author of the draft (activation) or of the restored version (rollback) */
  @Column({ name: 'authored_by', type: 'uuid', nullable: true })
  authoredBy: string | null;

  @Column({ name: 'approved_by', type: 'uuid' })
  approvedBy: string;

  @Column({ name: 'effective_from', type: 'timestamptz' })
  effectiveFrom: Date;

  @Column({ name: 'reason', type: 'text', nullable: true })
  reason: string | null;
}
