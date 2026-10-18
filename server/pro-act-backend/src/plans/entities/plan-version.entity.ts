import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { CalendarVersion } from '../../calendar/entities/calendar-version.entity';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import {
  APPROVAL_STATES,
  ApprovalState,
  Distribution,
  DISTRIBUTIONS,
  PLAN_BASES,
  PlanBasis,
  PlanWarning,
  TARGET_SOURCES,
  TargetSource,
} from '../../domain/plans/plan.types';
import { ProductionPlan } from '../../production-plan/production-plan.entity';
import { Unit } from '../../unit/unit.entity';
import { decimalStringTransformer } from '../../v2/common/decimal-string.transformer';
import { PlanScenario } from './plan-scenario.entity';

/** Per-leaf targets of a `manual` version, as entered (slice position + leaf start). */
export interface StoredManualTarget {
  slicePosition: number;
  utcStart: string;
  target: string;
}

/** Why the last generation of a draft failed (v1 bridge; the v2 API answers 422 instead). */
export interface GenerationFailure {
  code: string;
  message: string;
  at: string;
}

/**
 * One version of a plan (spec §14.2 `plan_versions`, PLAN02–PLAN04). The version carries its own copy of
 * the scope it plans (scenario, unit, window `[valid_from, valid_to)`), so later header edits never change
 * an approved version. A plan has at most one open (draft/submitted) and one approved version; approving
 * a version supersedes the previous approved one. Periods of approved/superseded versions are frozen
 * (DB trigger `plan_periods_frozen`).
 */
@Entity('plan_versions')
@Index('IDX_approval_inbox_plan_versions', { synchronize: false })
@Unique('UQ_plan_versions_plan_version', ['planId', 'version'])
@Index('UQ_plan_versions_plan_open', ['planId'], {
  unique: true,
  where: `"approval_state" IN ('draft', 'submitted')`,
})
@Index('UQ_plan_versions_plan_approved', ['planId'], {
  unique: true,
  where: `"approval_state" = 'approved'`,
})
@Index('IDX_plan_versions_tenant_unit', ['tenantId', 'unitId'])
@Index('IDX_plan_versions_scenario', ['scenarioId'])
@Index('IDX_plan_versions_unit', ['unitId'])
@Index('IDX_plan_versions_calendar_version', ['calendarVersionId'])
@Index('IDX_plan_versions_supersedes', ['supersedesVersionId'])
@Check('CHK_plan_versions_window', '"valid_to" > "valid_from"')
@Check(
  'CHK_plan_versions_approved_at',
  `"approval_state" NOT IN ('approved', 'superseded') OR "approved_at" IS NOT NULL`,
)
export class PlanVersion extends TenantScopedEntity {
  @Column({ name: 'plan_id', type: 'uuid' })
  planId: string;

  @ManyToOne(() => ProductionPlan, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'plan_id',
    foreignKeyConstraintName: 'FK_plan_versions_plan',
  })
  plan?: ProductionPlan;

  @Column({ name: 'version', type: 'int' })
  version: number;

  @Column({ name: 'scenario_id', type: 'uuid' })
  scenarioId: string;

  @ManyToOne(() => PlanScenario, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'scenario_id',
    foreignKeyConstraintName: 'FK_plan_versions_scenario',
  })
  scenario?: PlanScenario;

  @Column({ name: 'unit_id', type: 'uuid' })
  unitId: string;

  @ManyToOne(() => Unit, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'unit_id',
    foreignKeyConstraintName: 'FK_plan_versions_unit',
  })
  unit?: Unit;

  @Column({ name: 'valid_from', type: 'timestamptz' })
  validFrom: Date;

  @Column({ name: 'valid_to', type: 'timestamptz' })
  validTo: Date;

  @Column({
    name: 'basis',
    type: 'enum',
    enum: PLAN_BASES,
    enumName: 'plan_version_basis',
  })
  basis: PlanBasis;

  /** calendar version in force at the first leaf of the last generation */
  @Column({ name: 'calendar_version_id', type: 'uuid', nullable: true })
  calendarVersionId: string | null;

  @ManyToOne(() => CalendarVersion, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({
    name: 'calendar_version_id',
    foreignKeyConstraintName: 'FK_plan_versions_calendar_version',
  })
  calendarVersion?: CalendarVersion | null;

  /** quantity / manual: the entered total; time: Σ generated targets (null when slice units differ) */
  @Column({
    name: 'header_target',
    type: 'numeric',
    precision: 24,
    scale: 8,
    nullable: true,
    transformer: decimalStringTransformer,
  })
  headerTarget: string | null;

  @Column({
    name: 'target_source',
    type: 'enum',
    enum: TARGET_SOURCES,
    enumName: 'plan_version_target_source',
    default: 'generated',
  })
  targetSource: TargetSource;

  @Column({
    name: 'distribution',
    type: 'enum',
    enum: DISTRIBUTIONS,
    enumName: 'plan_version_distribution',
    default: 'scheduled_capacity',
  })
  distribution: Distribution;

  @Column({
    name: 'approval_state',
    type: 'enum',
    enum: APPROVAL_STATES,
    enumName: 'plan_version_approval_state',
    default: 'draft',
  })
  approvalState: ApprovalState;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @Column({ name: 'supersedes_version_id', type: 'uuid', nullable: true })
  supersedesVersionId: string | null;

  @ManyToOne(() => PlanVersion, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({
    name: 'supersedes_version_id',
    foreignKeyConstraintName: 'FK_plan_versions_supersedes',
  })
  supersedes?: PlanVersion | null;

  @Column({ name: 'change_reason', type: 'text', nullable: true })
  changeReason: string | null;

  @Column({ name: 'manual_targets', type: 'jsonb', nullable: true })
  manualTargets: StoredManualTarget[] | null;

  /** set by a successful generation; cleared by any content change of the draft */
  @Column({ name: 'periods_generated_at', type: 'timestamptz', nullable: true })
  periodsGeneratedAt: Date | null;

  @Column({ name: 'generation_warnings', type: 'jsonb', nullable: true })
  generationWarnings: PlanWarning[] | null;

  @Column({ name: 'generation_error', type: 'jsonb', nullable: true })
  generationError: GenerationFailure | null;
}
