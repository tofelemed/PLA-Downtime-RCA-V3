import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import { ProductionEvent } from '../production-event.entity';

export const REVIEW_ITEM_KINDS = [
  'source_vs_override_conflict',
  'late_correction',
  'retraction',
  'pending_source_confirmation',
  /** declared mode: planned - actual - shortfall of the declared figures is beyond the tolerance */
  'declared_identity_mismatch',
  /** declared mode: no (non-excluded) period of the unit is exactly the event's window */
  'declared_window_mismatch',
  /** declared mode: another production loss event of the unit overlaps this window */
  'duplicate_declared_loss',
  /** the source now reports a different reason code than the event's (the code stays; a person may dismiss) */
  'source_reason_changed',
] as const;
export type ReviewItemKind = (typeof REVIEW_ITEM_KINDS)[number];

/** The declared-figures kinds: a person may dismiss them; a re-sync that fixes the identity resolves that one. */
export const DECLARED_REVIEW_KINDS: readonly ReviewItemKind[] = [
  'declared_identity_mismatch',
  'declared_window_mismatch',
  'duplicate_declared_loss',
];

/** Kinds a person may dismiss: the declared kinds and a source re-coding (which allows nothing else). */
export const DISMISSABLE_REVIEW_KINDS: readonly ReviewItemKind[] = [
  ...DECLARED_REVIEW_KINDS,
  'source_reason_changed',
];

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

  @ManyToOne(() => ProductionEvent, { onDelete: 'RESTRICT' })
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
