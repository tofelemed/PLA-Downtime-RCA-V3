import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';
import { decimalStringTransformer } from '../../v2/common/decimal-string.transformer';
import { Signal } from './signal.entity';

export const SAMPLE_QUALITIES = [
  'good',
  'uncertain',
  'bad',
  'missing',
] as const;
export type SampleQualityValue = (typeof SAMPLE_QUALITIES)[number];

/**
 * Versioned measurement samples (spec §14.2 `measurement_samples`, §5.1 measurement identity = signal +
 * sample timestamp + source revision). A re-read of the same value is the same row; an archive
 * correction of the same timestamp is a new revision (the latest `inserted_at` wins). Range-partitioned
 * monthly by `observed_at` (`measurement_samples_ensure_partition`), so the primary key includes it.
 * Rows are never updated; retention drops whole partitions (3.12). Reads filter signal + time, served by
 * the identity key (signal_id, observed_at, …); a signal belongs to one tenant, so no tenant-led copy (DB-09).
 */
@Entity('measurement_samples')
@Unique('UQ_measurement_samples_identity', [
  'signalId',
  'observedAt',
  'sourceRevision',
])
export class MeasurementSample {
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  id: string;

  @PrimaryColumn({ name: 'observed_at', type: 'timestamptz' })
  observedAt: Date;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'signal_id', type: 'uuid' })
  signalId: string;

  @ManyToOne(() => Signal, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'signal_id' })
  signal?: Signal;

  @Column({
    name: 'value',
    type: 'numeric',
    precision: 24,
    scale: 8,
    nullable: true,
    transformer: decimalStringTransformer,
  })
  value: string | null;

  /** digital (enumeration-set) samples: state name and code */
  @Column({ name: 'state_name', type: 'text', nullable: true })
  stateName: string | null;

  @Column({ name: 'state_value', type: 'int', nullable: true })
  stateValue: number | null;

  @Column({
    name: 'quality',
    type: 'enum',
    enum: SAMPLE_QUALITIES,
    enumName: 'measurement_sample_quality',
  })
  quality: SampleQualityValue;

  /** source quality flags as delivered (PI: questionable, substituted, annotated, system state) */
  @Column({ name: 'quality_flags', type: 'jsonb', nullable: true })
  qualityFlags: string[] | null;

  @Column({ name: 'raw_id', type: 'uuid' })
  rawId: string;

  @Column({ name: 'raw_received_at', type: 'timestamptz' })
  rawReceivedAt: Date;

  @Column({ name: 'source_revision', type: 'text' })
  sourceRevision: string;

  @Column({
    name: 'inserted_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  insertedAt: Date;
}
