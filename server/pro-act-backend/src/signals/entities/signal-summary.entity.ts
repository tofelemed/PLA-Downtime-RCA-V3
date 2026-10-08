import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { decimalStringTransformer } from '../../v2/common/decimal-string.transformer';
import {
  SAMPLE_QUALITIES,
  SampleQualityValue,
} from './measurement-sample.entity';
import { Signal } from './signal.entity';

/**
 * PI `Total` summaries of rate signals (PI09): time-weighted totals per interval, stored only after the
 * basis was validated (rate signal, `TimeWeighted`, the PI total timebase equal to the signal's). They
 * cross-check rate integration; they are never a quantity of a cumulative counter. Same versioning as
 * samples: a changed total of the same interval is a new revision.
 */
@Entity('signal_summaries')
@Unique('UQ_signal_summaries_identity', [
  'signalId',
  'periodStart',
  'periodEnd',
  'sourceRevision',
])
@Index('IDX_signal_summaries_tenant_signal_period', [
  'tenantId',
  'signalId',
  'periodStart',
])
@Check('CHK_signal_summaries_period', '"period_end" > "period_start"')
export class SignalSummary {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'signal_id', type: 'uuid' })
  signalId: string;

  @ManyToOne(() => Signal, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'signal_id' })
  signal?: Signal;

  @Column({ name: 'period_start', type: 'timestamptz' })
  periodStart: Date;

  @Column({ name: 'period_end', type: 'timestamptz' })
  periodEnd: Date;

  @Column({
    name: 'total',
    type: 'numeric',
    precision: 24,
    scale: 8,
    nullable: true,
    transformer: decimalStringTransformer,
  })
  total: string | null;

  @Column({ name: 'summary_type', type: 'varchar', length: 32 })
  summaryType: string;

  @Column({ name: 'calculation_basis', type: 'varchar', length: 32 })
  calculationBasis: string;

  /** the timebase PI assumed for the total, validated equal to the signal's `rate_timebase` */
  @Column({ name: 'timebase', type: 'varchar', length: 8 })
  timebase: string;

  @Column({
    name: 'quality',
    type: 'enum',
    enum: SAMPLE_QUALITIES,
    enumName: 'measurement_sample_quality',
  })
  quality: SampleQualityValue;

  @Column({ name: 'raw_id', type: 'uuid' })
  rawId: string;

  @Column({ name: 'raw_received_at', type: 'timestamptz' })
  rawReceivedAt: Date;

  @Column({ name: 'source_revision', type: 'text' })
  sourceRevision: string;

  @Column({ name: 'inserted_at', type: 'timestamptz', default: () => 'now()' })
  insertedAt: Date;
}
