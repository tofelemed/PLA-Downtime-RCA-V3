import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { PlanScenario } from '../plans/entities/plan-scenario.entity';
import { Product } from '../product/product.entity';
import { Unit } from '../unit/unit.entity';

/**
 * v1 plan header (kept for the legacy screens, C4). Plan 2.3 adds the version model: `scenario_id`,
 * `current_version` (→ `plan_versions`), `legacy_id` (= id of rows that existed before 2.3, for the 3.10
 * crosswalk) and uuid foreign keys `unit_ref_id` / `product_ref_id` next to the varchar `unit_id` /
 * `product_id` (expand step; the varchar columns are contracted in 3.10).
 */
@Entity('production_plans')
@Index('IDX_production_plans_scenario', ['scenarioId'])
@Index('IDX_production_plans_unit_ref', ['unitRefId'])
@Index('IDX_production_plans_product_ref', ['productRefId'])
export class ProductionPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'plan_name', type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'unit_id', type: 'varchar', length: 36 })
  unitId: string;

  @Column({ name: 'product_id', type: 'varchar', length: 36, nullable: true })
  productId?: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId?: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant?: Tenant;

  @Column({
    name: 'organization_id',
    type: 'varchar',
    length: 36,
    nullable: true,
  })
  organizationId?: string;

  @Column({ name: 'start_date', type: 'timestamptz' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'timestamptz' })
  endDate: Date;

  @Column({
    name: 'target_quantity',
    type: 'decimal',
    precision: 15,
    scale: 4,
    nullable: true,
  })
  plannedQuantity?: number;

  @Column({
    name: 'actual_quantity',
    type: 'decimal',
    precision: 15,
    scale: 4,
    nullable: true,
  })
  actualQuantity?: number;

  @Column({ name: 'status', type: 'varchar', length: 50, nullable: true })
  status?: string;

  @Column({
    name: 'tolerance_limit',
    type: 'decimal',
    precision: 15,
    scale: 4,
    nullable: true,
  })
  toleranceLimit?: number;

  @Column({ name: 'plan_basis', type: 'varchar', length: 255, nullable: true })
  planBasis?: string;

  @Column({ name: 'useful_production_time', type: 'text', nullable: true })
  usefulProductionTime?: string; // JSON string

  @Column({ name: 'recurrence', type: 'varchar', length: 100, nullable: true })
  recurrence?: string;

  @Column({
    name: 'data_entry_frequency',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  dataEntryFrequency?: string;

  @Column({ name: 'shift', type: 'varchar', length: 50, nullable: true })
  shift?: string;

  @Column({ name: 'crew', type: 'varchar', length: 100, nullable: true })
  crew?: string;

  @Column({ name: 'planner_notes', type: 'text', nullable: true })
  plannerNotes?: string;

  @Column({ name: 'comments', type: 'text', nullable: true })
  comments?: string; // JSON string

  @Column({
    name: 'approval_status',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  approvalStatus?: string;

  @Column({ name: 'submitted_by', type: 'varchar', length: 36, nullable: true })
  submittedBy?: string;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt?: Date;

  @Column({ name: 'reviewed_by', type: 'varchar', length: 36, nullable: true })
  reviewedBy?: string;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt?: Date;

  @Column({ name: 'approved_by', type: 'varchar', length: 36, nullable: true })
  approvedBy?: string;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt?: Date;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason?: string;

  @Column({ name: 'custom_attributes', type: 'text', nullable: true })
  customAttributes?: string; // JSON string

  @Column({ name: 'audit_trail', type: 'text', nullable: true })
  auditTrail?: string; // JSON string

  @Column({ name: 'legacy_id', type: 'uuid', nullable: true })
  legacyId?: string | null;

  @Column({ name: 'scenario_id', type: 'uuid', nullable: true })
  scenarioId?: string | null;

  @ManyToOne(() => PlanScenario, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({
    name: 'scenario_id',
    foreignKeyConstraintName: 'FK_production_plans_scenario',
  })
  scenario?: PlanScenario | null;

  /** number of the newest plan version (null for legacy rows without a resolvable unit) */
  @Column({ name: 'current_version', type: 'int', nullable: true })
  currentVersion?: number | null;

  @Column({ name: 'unit_ref_id', type: 'uuid', nullable: true })
  unitRefId?: string | null;

  @ManyToOne(() => Unit, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({
    name: 'unit_ref_id',
    foreignKeyConstraintName: 'FK_production_plans_unit_ref',
  })
  unitRef?: Unit | null;

  @Column({ name: 'product_ref_id', type: 'uuid', nullable: true })
  productRefId?: string | null;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({
    name: 'product_ref_id',
    foreignKeyConstraintName: 'FK_production_plans_product_ref',
  })
  productRef?: Product | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
