import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import {
  IMPACT_MODES,
  ImpactMode,
  OEE_COMPONENTS,
  OeeComponent,
  SCHEDULE_CLASSES,
  ScheduleClass,
} from '../../domain/events/event-classification';
import { CodeVersion } from '../../code-library/code-version.entity';
import { decimalStringTransformer } from '../../v2/common/decimal-string.transformer';
import { ProductionEvent } from '../production-event.entity';
import { EventFacts } from './event-facts';

/**
 * Explicit effective coding revision of an event (spec §14.2 `event_coding`, ING06): who coded what,
 * when, old and new values, and whether it overrides a source value. Own sequence per event. Code
 * columns hold the stable code ids; `*_version_id` the exact code versions at coding time (plan 1.3).
 */
@Entity('event_coding')
@Unique('UQ_event_coding_event_revision', ['eventId', 'revision'])
@Index('IDX_event_coding_tenant_event', ['tenantId', 'eventId'])
export class EventCoding extends TenantScopedEntity {
  @Column({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @ManyToOne(() => ProductionEvent, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'event_id' })
  event?: ProductionEvent;

  @Column({ name: 'revision', type: 'int' })
  revision: number;

  @Column({ name: 'reason_code_id', type: 'uuid', nullable: true })
  reasonCodeId: string | null;

  @Column({ name: 'impact_code_id', type: 'uuid', nullable: true })
  impactCodeId: string | null;

  @Column({ name: 'oee_code_id', type: 'uuid', nullable: true })
  oeeCodeId: string | null;

  /** `code_versions` rows of the codes above at coding time (plan 1.3) */
  @Column({ name: 'reason_code_version_id', type: 'uuid', nullable: true })
  reasonCodeVersionId: string | null;

  @ManyToOne(() => CodeVersion, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'reason_code_version_id' })
  reasonCodeVersion?: CodeVersion;

  @Column({ name: 'impact_code_version_id', type: 'uuid', nullable: true })
  impactCodeVersionId: string | null;

  @ManyToOne(() => CodeVersion, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'impact_code_version_id' })
  impactCodeVersion?: CodeVersion;

  @Column({ name: 'oee_code_version_id', type: 'uuid', nullable: true })
  oeeCodeVersionId: string | null;

  @ManyToOne(() => CodeVersion, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'oee_code_version_id' })
  oeeCodeVersion?: CodeVersion;

  @Column({
    name: 'schedule_class',
    type: 'enum',
    enum: SCHEDULE_CLASSES,
    enumName: 'production_event_schedule_class',
  })
  scheduleClass: ScheduleClass;

  @Column({
    name: 'oee_component',
    type: 'enum',
    enum: OEE_COMPONENTS,
    enumName: 'production_event_oee_component',
  })
  oeeComponent: OeeComponent;

  @Column({
    name: 'impact_mode',
    type: 'enum',
    enum: IMPACT_MODES,
    enumName: 'production_event_impact_mode',
  })
  impactMode: ImpactMode;

  @Column({
    name: 'impact_fraction',
    type: 'numeric',
    precision: 9,
    scale: 8,
    nullable: true,
    transformer: decimalStringTransformer,
  })
  impactFraction: string | null;

  @Column({ name: 'comment', type: 'text', nullable: true })
  comment: string | null;

  @Column({ name: 'is_override', type: 'boolean', default: false })
  isOverride: boolean;

  /** `event_revisions.revision` of the source revision this coding overrides */
  @Column({ name: 'overrides_source_revision', type: 'int', nullable: true })
  overridesSourceRevision: number | null;

  @Column({ name: 'old_values', type: 'jsonb' })
  oldValues: EventFacts;

  @Column({ name: 'new_values', type: 'jsonb' })
  newValues: EventFacts;

  @Column({ name: 'reason', type: 'text', nullable: true })
  reason: string | null;

  @Column({ name: 'author_id', type: 'uuid', nullable: true })
  authorId: string | null;
}
