import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import { ProductionEvent } from '../production-event.entity';

export const REVIEW_ITEM_KINDS = [
  'source_vs_override_conflict',
  'late_correction',
  'retraction',
] as const;
export type ReviewItemKind = (typeof REVIEW_ITEM_KINDS)[number];

export const REVIEW_ITEM_STATES = [
  'open',
  'kept_override',
  'accepted_source',
  'dismissed',
] as const;
export type ReviewItemState = (typeof REVIEW_ITEM_STATES)[number];

/**
 * A decision a person owes on an event (spec §5.3), e.g. the source changed a field the user
 * overrode. The effective value stays the override until the item is resolved.
 */
@Entity('event_review_items')
@Index('IDX_event_review_items_tenant_state', ['tenantId', 'state'])
@Index('IDX_event_review_items_event', ['eventId'])
export class EventReviewItem extends TenantScopedEntity {
  @Column({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @ManyToOne(() => ProductionEvent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event?: ProductionEvent;

  @Column({
    name: 'kind',
    type: 'enum',
    enum: REVIEW_ITEM_KINDS,
    enumName: 'event_review_item_kind',
  })
  kind: ReviewItemKind;

  /** the conflicting field (conflict items) */
  @Column({ name: 'field', type: 'varchar', length: 64, nullable: true })
  field: string | null;

  @Column({ name: 'source_revision_id', type: 'uuid', nullable: true })
  sourceRevisionId: string | null;

  @Column({ name: 'coding_revision_id', type: 'uuid', nullable: true })
  codingRevisionId: string | null;

  @Column({
    name: 'state',
    type: 'enum',
    enum: REVIEW_ITEM_STATES,
    enumName: 'event_review_item_state',
    default: 'open',
  })
  state: ReviewItemState;

  @Column({ name: 'resolved_by', type: 'uuid', nullable: true })
  resolvedBy: string | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;
}
