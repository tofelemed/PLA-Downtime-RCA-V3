import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantOwnedEntity } from '../../common/entities/tenant-scoped.entity';
import { decimalStringTransformer } from '../../v2/common/decimal-string.transformer';
import { LossLine } from './loss-line.entity';

/**
 * Evidence of a loss line (spec §14.2 `loss_line_evidence`, ACC05): the event revision (or observation)
 * and occurrence behind it, the share of the segment allocated to that cause and the clipped interval.
 * Event references carry no foreign key: v1 may still delete legacy events, the evidence stays. Immutable.
 */
@Entity('loss_line_evidence')
@Index('IDX_loss_line_evidence_line', ['lossLineId'])
@Index('IDX_loss_line_evidence_tenant_event', ['tenantId', 'eventId'])
@Index('IDX_loss_line_evidence_event_revision', ['eventRevisionId'])
export class LossLineEvidence extends TenantOwnedEntity {
  @Column({ name: 'loss_line_id', type: 'uuid' })
  lossLineId: string;

  @ManyToOne(() => LossLine, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'loss_line_id',
    foreignKeyConstraintName: 'FK_loss_line_evidence_line',
  })
  lossLine?: LossLine;

  @Column({ name: 'event_id', type: 'uuid', nullable: true })
  eventId: string | null;

  @Column({ name: 'event_revision_id', type: 'uuid', nullable: true })
  eventRevisionId: string | null;

  @Column({ name: 'observation_id', type: 'uuid', nullable: true })
  observationId: string | null;

  @Column({ name: 'occurrence_id', type: 'uuid', nullable: true })
  occurrenceId: string | null;

  @Column({
    name: 'share',
    type: 'numeric',
    precision: 9,
    scale: 8,
    transformer: decimalStringTransformer,
  })
  share: string;

  @Column({ name: 'clipped_start', type: 'timestamptz' })
  clippedStart: Date;

  @Column({ name: 'clipped_end', type: 'timestamptz' })
  clippedEnd: Date;
}
