import {
  Check,
  Column,
  Entity,
  Exclusion,
  Index,
  JoinColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { ShiftInstance } from '../../calendar/entities/shift-instance.entity';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import { PlanVersion } from '../../plans/entities/plan-version.entity';
import { Unit } from '../../unit/unit.entity';

export const READINESS_STATES = [
  'open',
  'complete_inputs',
  'reconciled',
] as const;
export type ReadinessState = (typeof READINESS_STATES)[number];

/** Why a period has no slice, or something else a reviewer should know about its inputs. */
export interface PeriodWarning {
  code: string;
  message: string;
  detail?: Record<string, unknown>;
}

/**
 * The accounting grain (spec §3.1, §14.2 `production_periods`): one row per unit per calendar leaf,
 * created from a shift instance whose UTC bounds, operational date and shift name are copied (the
 * instance may later be regenerated; the copy stays and the link drops). Periods of a unit never overlap.
 * `state_readiness` is display only — the approval workflow lives in accounting revisions (2.8).
 */
@Entity('production_periods')
@Unique('UQ_production_periods_unit_start', ['tenantId', 'unitId', 'utcStart'])
@Exclusion(
  'EX_production_periods_unit_no_overlap',
  `USING gist ("unit_id" WITH =, tstzrange("utc_start", "utc_end", '[)') WITH &&)`,
)
@Index('IDX_production_periods_tenant_date', ['tenantId', 'localDate'])
@Index('IDX_production_periods_tenant_start', ['tenantId', 'utcStart'])
@Index('IDX_production_periods_unit', ['unitId'])
@Index('IDX_production_periods_shift_instance', ['shiftInstanceId'])
@Index('IDX_production_periods_plan_version', ['selectedPlanVersionId'])
@Index('IDX_production_periods_current_run', ['currentActualsRunId'])
@Check('CHK_production_periods_interval', '"utc_end" > "utc_start"')
export class ProductionPeriod extends TenantScopedEntity {
  @Column({ name: 'unit_id', type: 'uuid' })
  unitId: string;

  @ManyToOne(() => Unit, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'unit_id',
    foreignKeyConstraintName: 'FK_production_periods_unit',
  })
  unit?: Unit;

  @Column({ name: 'shift_instance_id', type: 'uuid', nullable: true })
  shiftInstanceId: string | null;

  @ManyToOne(() => ShiftInstance, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'shift_instance_id',
    foreignKeyConstraintName: 'FK_production_periods_shift_instance',
  })
  shiftInstance?: ShiftInstance | null;

  /** copy of the instance's calendar version (no FK) */
  @Column({ name: 'calendar_version_id', type: 'uuid', nullable: true })
  calendarVersionId: string | null;

  @Column({ name: 'utc_start', type: 'timestamptz' })
  utcStart: Date;

  @Column({ name: 'utc_end', type: 'timestamptz' })
  utcEnd: Date;

  /** operational (production) date */
  @Column({ name: 'local_date', type: 'date' })
  localDate: string;

  /** null on daily-leaf sites (D03) */
  @Column({ name: 'shift_name', type: 'varchar', length: 64, nullable: true })
  shiftName: string | null;

  @Column({ name: 'is_excluded', type: 'boolean', default: false })
  isExcluded: boolean;

  @Column({
    name: 'exclusion_kind',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  exclusionKind: string | null;

  /** the accounting-baseline plan version the slices came from (null = profile default product) */
  @Column({ name: 'selected_plan_version_id', type: 'uuid', nullable: true })
  selectedPlanVersionId: string | null;

  @ManyToOne(() => PlanVersion, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({
    name: 'selected_plan_version_id',
    foreignKeyConstraintName: 'FK_production_periods_plan_version',
  })
  selectedPlanVersion?: PlanVersion | null;

  @Column({
    name: 'state_readiness',
    type: 'enum',
    enum: READINESS_STATES,
    enumName: 'production_period_readiness',
    default: 'open',
  })
  stateReadiness: ReadinessState;

  /** latest actuals run (no FK: runs reference periods) */
  @Column({ name: 'current_actuals_run_id', type: 'uuid', nullable: true })
  currentActualsRunId: string | null;

  @Column({ name: 'slices_resolved_at', type: 'timestamptz', nullable: true })
  slicesResolvedAt: Date | null;

  @Column({ name: 'warnings', type: 'jsonb', default: () => "'[]'" })
  warnings: PeriodWarning[];
}
