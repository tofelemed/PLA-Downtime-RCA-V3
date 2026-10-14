import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { ShiftInstance } from '../../calendar/entities/shift-instance.entity';
import { TenantOwnedEntity } from '../../common/entities/tenant-scoped.entity';
import { UnitProductRate } from '../../profiles/entities/unit-product-rate.entity';
import { Unit } from '../../unit/unit.entity';
import { decimalStringTransformer } from '../../v2/common/decimal-string.transformer';
import { PlanProductSlice } from './plan-product-slice.entity';
import { PlanVersion } from './plan-version.entity';

const quantity = (name: string, nullable: boolean) => ({
  name,
  type: 'numeric' as const,
  precision: 24,
  scale: 8,
  nullable,
  transformer: decimalStringTransformer,
});

/**
 * One leaf of a plan version for one product slice (spec §14.2 `plan_periods`, PLAN03): UTC bounds
 * (half-open), operational date and shift copied from the shift instance (the instance may later be
 * regenerated; the copy stays), scheduled seconds, target, planning and sustained capacity, and the
 * profile / rate versions they came from. Rows of approved or superseded versions are frozen by the
 * `plan_periods_frozen` trigger.
 */
@Entity('plan_periods')
@Unique('UQ_plan_periods_version_slice_start', [
  'planVersionId',
  'sliceId',
  'utcStart',
])
@Index('IDX_plan_periods_tenant_unit_start', ['tenantId', 'unitId', 'utcStart'])
@Index('IDX_plan_periods_slice', ['sliceId'])
@Index('IDX_plan_periods_unit', ['unitId'])
@Index('IDX_plan_periods_shift_instance', ['shiftInstanceId'])
@Index('IDX_plan_periods_planning_rate', ['planningRateVersionId'])
@Index('IDX_plan_periods_sustained_rate', ['sustainedRateVersionId'])
@Check('CHK_plan_periods_interval', '"utc_end" > "utc_start"')
@Check('CHK_plan_periods_target', '"target" >= 0')
export class PlanPeriod extends TenantOwnedEntity {
  @Column({ name: 'plan_version_id', type: 'uuid' })
  planVersionId: string;

  @ManyToOne(() => PlanVersion, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'plan_version_id',
    foreignKeyConstraintName: 'FK_plan_periods_version',
  })
  planVersion?: PlanVersion;

  @Column({ name: 'slice_id', type: 'uuid' })
  sliceId: string;

  @ManyToOne(() => PlanProductSlice, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'slice_id',
    foreignKeyConstraintName: 'FK_plan_periods_slice',
  })
  slice?: PlanProductSlice;

  @Column({ name: 'unit_id', type: 'uuid' })
  unitId: string;

  @ManyToOne(() => Unit, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'unit_id',
    foreignKeyConstraintName: 'FK_plan_periods_unit',
  })
  unit?: Unit;

  /** the source instance; set null when the calendar regenerates it (the copied bounds stay) */
  @Column({ name: 'shift_instance_id', type: 'uuid', nullable: true })
  shiftInstanceId: string | null;

  @ManyToOne(() => ShiftInstance, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'shift_instance_id',
    foreignKeyConstraintName: 'FK_plan_periods_shift_instance',
  })
  shiftInstance?: ShiftInstance | null;

  /** calendar version the instance was generated from (no FK: a copy of the source version) */
  @Column({ name: 'calendar_version_id', type: 'uuid', nullable: true })
  calendarVersionId: string | null;

  @Column({ name: 'utc_start', type: 'timestamptz' })
  utcStart: Date;

  @Column({ name: 'utc_end', type: 'timestamptz' })
  utcEnd: Date;

  /** operational (production) date */
  @Column({ name: 'local_date', type: 'date' })
  localDate: string;

  @Column({ name: 'shift_name', type: 'varchar', length: 64 })
  shiftName: string;

  @Column({ name: 'scheduled_seconds', type: 'int' })
  scheduledSeconds: number;

  @Column(quantity('target', false))
  target: string;

  @Column(quantity('planning_capacity_qty', true))
  planningCapacityQty: string | null;

  @Column(quantity('sustained_capacity_qty', true))
  sustainedCapacityQty: string | null;

  @Column({ name: 'quantity_uom', type: 'varchar', length: 50, nullable: true })
  quantityUom: string | null;

  /** profile version the rates came from (no FK: rates carry it) */
  @Column({ name: 'profile_id', type: 'uuid', nullable: true })
  profileId: string | null;

  @Column({ name: 'planning_rate_version_id', type: 'uuid', nullable: true })
  planningRateVersionId: string | null;

  @ManyToOne(() => UnitProductRate, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({
    name: 'planning_rate_version_id',
    foreignKeyConstraintName: 'FK_plan_periods_planning_rate',
  })
  planningRate?: UnitProductRate | null;

  @Column({ name: 'sustained_rate_version_id', type: 'uuid', nullable: true })
  sustainedRateVersionId: string | null;

  @ManyToOne(() => UnitProductRate, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({
    name: 'sustained_rate_version_id',
    foreignKeyConstraintName: 'FK_plan_periods_sustained_rate',
  })
  sustainedRate?: UnitProductRate | null;

  @Column({ name: 'is_excluded', type: 'boolean', default: false })
  isExcluded: boolean;

  @Column({
    name: 'exclusion_kind',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  exclusionKind: string | null;
}
