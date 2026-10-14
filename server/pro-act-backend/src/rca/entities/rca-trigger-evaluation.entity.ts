import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import { RCA } from '../rca.entity';

export const TRIGGER_FIRED_ON = [
  'threshold_crossed_open',
  'closed',
  'approved',
] as const;
export const TRIGGER_OUTCOMES = [
  'recommended',
  'case_created',
  'linked_to_case',
  'suppressed_duplicate',
] as const;
export const RECOMMENDATION_STATES = ['open', 'accepted', 'dismissed'] as const;
export type RecommendationState = (typeof RECOMMENDATION_STATES)[number];

/**
 * One firing of an RCA trigger (plan 3.9, RCA01): the policy or `rca_trigger_hint` rule version that
 * fired for an event / occurrence, whether it was provisional (open event, elapsed time), and what it
 * did. `idempotency_key` = `<rule or policy version>:<occurrence>` is unique per tenant, so closure,
 * replays and re-evaluations never fire twice. A recommendation stays open until a person links or
 * creates a case (`accepted`) or dismisses it.
 */
@Entity('rca_trigger_evaluations')
@Unique('UQ_rca_trigger_evaluations_key', ['tenantId', 'idempotencyKey'])
@Index('IDX_rca_trigger_evaluations_event', ['tenantId', 'eventId'])
@Index('IDX_rca_trigger_evaluations_state', ['tenantId', 'state', 'firedAt'])
export class RcaTriggerEvaluation extends TenantScopedEntity {
  @Column({ name: 'idempotency_key', type: 'varchar', length: 200 })
  idempotencyKey: string;

  /** `policy` (rca_policy) or `rule` (rca_trigger_hint) */
  @Column({ name: 'source_kind', type: 'varchar', length: 16 })
  sourceKind: 'policy' | 'rule';

  @Column({ name: 'source_id', type: 'uuid' })
  sourceId: string;

  @Column({ name: 'source_version', type: 'int' })
  sourceVersion: number;

  /** duration, repeat or rule */
  @Column({ name: 'trigger', type: 'varchar', length: 16 })
  trigger: string;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @Column({ name: 'occurrence_id', type: 'uuid', nullable: true })
  occurrenceId: string | null;

  @Index('IDX_rca_trigger_evaluations_unit')
  @Column({ name: 'unit_id', type: 'uuid' })
  unitId: string;

  @Column({
    name: 'fired_on',
    type: 'enum',
    enum: TRIGGER_FIRED_ON,
    enumName: 'rca_trigger_fired_on',
  })
  firedOn: (typeof TRIGGER_FIRED_ON)[number];

  @Column({ name: 'provisional', type: 'boolean' })
  provisional: boolean;

  @Column({
    name: 'outcome',
    type: 'enum',
    enum: TRIGGER_OUTCOMES,
    enumName: 'rca_trigger_outcome',
  })
  outcome: (typeof TRIGGER_OUTCOMES)[number];

  @Column({ name: 'state', type: 'varchar', length: 16 })
  state: RecommendationState;

  @Column({ name: 'rca_id', type: 'uuid', nullable: true })
  rcaId: string | null;

  @ManyToOne(() => RCA, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'rca_id',
    foreignKeyConstraintName: 'FK_rca_trigger_evaluations_rca',
  })
  rca?: RCA | null;

  @Column({ name: 'detail', type: 'jsonb' })
  detail: Record<string, unknown>;

  @Column({ name: 'fired_at', type: 'timestamptz' })
  firedAt: Date;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;

  @Column({ name: 'resolved_by', type: 'uuid', nullable: true })
  resolvedBy: string | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;
}
