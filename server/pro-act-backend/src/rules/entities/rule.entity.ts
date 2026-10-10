import { Column, Entity, Index, Unique } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import {
  RULE_KINDS,
  RULE_STATES,
  RuleKind,
  RuleState,
} from '../grammar/rule-catalog';
import { RuleDefinition } from '../grammar/rule-definition';

/**
 * A declarative admin rule (plan 3.8, NFR02): its identity, kind, state and the version in force. The
 * definitions themselves live in immutable `rule_versions` rows; `draft_definition` is the editable
 * working copy that becomes the next version when a second person activates it (separation of duties).
 */
@Entity('rules')
@Unique('UQ_rules_tenant_name', ['tenantId', 'name'])
@Index('IDX_rules_tenant_kind_state', ['tenantId', 'kind', 'state'])
export class Rule extends TenantScopedEntity {
  @Column({
    name: 'kind',
    type: 'enum',
    enum: RULE_KINDS,
    enumName: 'rule_kind',
  })
  kind: RuleKind;

  @Column({ name: 'name', type: 'varchar', length: 120 })
  name: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  /** evaluation order among active rules of one kind (lower first; ties by name) */
  @Column({ name: 'priority', type: 'int', default: 100 })
  priority: number;

  @Column({
    name: 'state',
    type: 'enum',
    enum: RULE_STATES,
    enumName: 'rule_state',
  })
  state: RuleState;

  /** version in force while `state = active` */
  @Column({ name: 'active_version', type: 'int', nullable: true })
  activeVersion: number | null;

  @Column({ name: 'draft_definition', type: 'jsonb', nullable: true })
  draftDefinition: RuleDefinition | null;

  /** author of the pending draft; cannot activate it */
  @Column({ name: 'draft_author', type: 'uuid', nullable: true })
  draftAuthor: string | null;

  @Column({ name: 'draft_updated_at', type: 'timestamptz', nullable: true })
  draftUpdatedAt: Date | null;

  @Column({ name: 'retired_at', type: 'timestamptz', nullable: true })
  retiredAt: Date | null;
}
