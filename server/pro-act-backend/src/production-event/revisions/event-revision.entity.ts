import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import { ProductionEvent } from '../production-event.entity';
import { EventFacts } from './event-facts';

export const REVISION_KINDS = [
  'source',
  'user',
  'system',
  'retraction',
] as const;
export type RevisionKind = (typeof REVISION_KINDS)[number];

export const ACTOR_KINDS = ['user', 'connector', 'system'] as const;
export type ActorKind = (typeof ACTOR_KINDS)[number];

/**
 * Immutable revision of a production event (spec §14.2 `event_revisions`, ING01/ING06). One sequence
 * per event across all kinds; `effective_facts` is the event as it looked after this revision.
 */
@Entity('event_revisions')
@Unique('UQ_event_revisions_event_revision', ['eventId', 'revision'])
@Index('IDX_event_revisions_tenant_event', ['tenantId', 'eventId'])
export class EventRevision extends TenantScopedEntity {
  @Column({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @ManyToOne(() => ProductionEvent, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'event_id' })
  event?: ProductionEvent;

  @Column({ name: 'revision', type: 'int' })
  revision: number;

  @Column({
    name: 'kind',
    type: 'enum',
    enum: REVISION_KINDS,
    enumName: 'event_revision_kind',
  })
  kind: RevisionKind;

  /** what the source said (source revisions, and the baseline of source events) */
  @Column({ name: 'source_facts', type: 'jsonb', nullable: true })
  sourceFacts: EventFacts | null;

  @Column({ name: 'effective_facts', type: 'jsonb' })
  effectiveFacts: EventFacts;

  @Column({ name: 'change_reason', type: 'text', nullable: true })
  changeReason: string | null;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({
    name: 'actor_kind',
    type: 'enum',
    enum: ACTOR_KINDS,
    enumName: 'event_revision_actor_kind',
  })
  actorKind: ActorKind;

  /** version marker of the source system itself (e.g. the PI frame end time) */
  @Column({
    name: 'source_revision',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  sourceRevision: string | null;
}
