import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import { RuleDefinition } from '../grammar/rule-definition';
import { Rule } from './rule.entity';

export interface RuleRunScope {
  from: string;
  to: string;
  unitIds: string[] | null;
}

/**
 * A simulation of a rule over stored events (plan 3.8 `rule_runs`): the definition evaluated (draft or
 * a version), the sample scope and the before/after results, kept for the audit trail of a change.
 */
@Entity('rule_runs')
@Index('IDX_rule_runs_tenant_rule_ran', ['tenantId', 'ruleId', 'ranAt'])
export class RuleRun extends TenantScopedEntity {
  @Column({ name: 'rule_id', type: 'uuid' })
  ruleId: string;

  @ManyToOne(() => Rule, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'rule_id' })
  rule?: Rule;

  /** version simulated; null = the draft */
  @Column({ name: 'version', type: 'int', nullable: true })
  version: number | null;

  @Column({ name: 'definition', type: 'jsonb' })
  definition: RuleDefinition;

  @Column({ name: 'sample_scope', type: 'jsonb' })
  sampleScope: RuleRunScope;

  @Column({ name: 'results', type: 'jsonb' })
  results: Record<string, unknown>;

  @Column({ name: 'ran_at', type: 'timestamptz' })
  ranAt: Date;
}
