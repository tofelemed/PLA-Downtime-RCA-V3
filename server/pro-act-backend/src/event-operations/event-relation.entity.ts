import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { TenantScopedEntity } from '../common/entities/tenant-scoped.entity';
import { ProductionEvent } from '../production-event/production-event.entity';
import { decimalStringTransformer } from '../v2/common/decimal-string.transformer';

export const EVENT_RELATION_TYPES = [
  'split_child_of',
  'merged_from',
  'correlated_with',
  'impact_of',
] as const;
export type EventRelationType = (typeof EVENT_RELATION_TYPES)[number];

/**
 * Lineage between events (spec §14.2 `event_relations`, plan 1.4). `split_child_of`: from = child,
 * to = split parent; `merged_from`: from = merged event, to = contributor. Same tenant on both ends
 * (enforced by the commands); no self-relations.
 */
@Entity('event_relations')
@Check('CHK_event_relations_not_self', '"from_event_id" <> "to_event_id"')
@Unique('UQ_event_relations_from_to_type', [
  'fromEventId',
  'toEventId',
  'relationType',
])
@Index('IDX_event_relations_tenant_from', ['tenantId', 'fromEventId'])
@Index('IDX_event_relations_tenant_to', ['tenantId', 'toEventId'])
export class EventRelation extends TenantScopedEntity {
  @Column({ name: 'from_event_id', type: 'uuid' })
  fromEventId: string;

  @ManyToOne(() => ProductionEvent, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'from_event_id' })
  fromEvent?: ProductionEvent;

  @Column({ name: 'to_event_id', type: 'uuid' })
  toEventId: string;

  @ManyToOne(() => ProductionEvent, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'to_event_id' })
  toEvent?: ProductionEvent;

  @Column({
    name: 'relation_type',
    type: 'enum',
    enum: EVENT_RELATION_TYPES,
    enumName: 'event_relation_type',
  })
  relationType: EventRelationType;

  /** physical stop occurrence both ends belong to (KPI06 counts occurrences, not fragments) */
  @Column({ name: 'occurrence_id', type: 'uuid', nullable: true })
  occurrenceId: string | null;

  /** 0..1 for inferred (correlated) relations; null for operator lineage */
  @Column({
    name: 'confidence',
    type: 'numeric',
    precision: 5,
    scale: 4,
    nullable: true,
    transformer: decimalStringTransformer,
  })
  confidence: string | null;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string | null;
}
