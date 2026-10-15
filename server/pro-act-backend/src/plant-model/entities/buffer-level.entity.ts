import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import { Unit } from '../../unit/unit.entity';
import { decimalStringTransformer } from '../../v2/common/decimal-string.transformer';

export const BUFFER_LEVEL_SOURCES = ['manual', 'signal', 'import'] as const;
export type BufferLevelSource = (typeof BUFFER_LEVEL_SOURCES)[number];

/**
 * A recorded level of the buffer between two units (SME E2): an upstream stop starting soon after it
 * uses the level above the route's lowest operating level as its cover, instead of the configured
 * usable inventory.
 */
@Entity('buffer_levels')
@Unique('UQ_buffer_levels_reading', [
  'tenantId',
  'fromUnitId',
  'toUnitId',
  'observedAt',
])
@Index('IDX_buffer_levels_tenant_to_observed', [
  'tenantId',
  'toUnitId',
  'observedAt',
])
@Index('IDX_buffer_levels_from_unit', ['fromUnitId'])
@Index('IDX_buffer_levels_to_unit', ['toUnitId'])
@Check('CHK_buffer_levels_level', '"level" >= 0')
@Check('CHK_buffer_levels_source', `"source" IN ('manual', 'signal', 'import')`)
export class BufferLevelRecord extends TenantScopedEntity {
  @Column({ name: 'from_unit_id', type: 'uuid' })
  fromUnitId: string;

  @ManyToOne(() => Unit, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'from_unit_id',
    foreignKeyConstraintName: 'FK_buffer_levels_from_unit',
  })
  fromUnit?: Unit;

  @Column({ name: 'to_unit_id', type: 'uuid' })
  toUnitId: string;

  @ManyToOne(() => Unit, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'to_unit_id',
    foreignKeyConstraintName: 'FK_buffer_levels_to_unit',
  })
  toUnit?: Unit;

  @Column({ name: 'observed_at', type: 'timestamptz' })
  observedAt: Date;

  @Column({
    name: 'level',
    type: 'numeric',
    precision: 24,
    scale: 8,
    transformer: decimalStringTransformer,
  })
  level: string;

  @Column({ name: 'uom', type: 'varchar', length: 50 })
  uom: string;

  @Column({ name: 'source', type: 'varchar', length: 16, default: 'manual' })
  source: BufferLevelSource;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;
}
