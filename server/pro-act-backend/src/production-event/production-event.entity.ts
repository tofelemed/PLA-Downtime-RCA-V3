import {
  Check,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  VersionColumn,
} from 'typeorm';
import { ClassificationBasis } from '../code-library/classification-basis';
import { ProductionPlan } from '../production-plan/production-plan.entity';
import { Unit } from '../unit/unit.entity';
import { Asset } from '../asset/asset.entity';
import { ImpactCode } from '../impact-code/impact-code.entity';
import { OEECode } from '../oee-code/oee-code.entity';
import { RCA } from '../rca/rca.entity';
import { ReasonCode } from '../reason-code/reason-code.entity';
import {
  CODING_STATES,
  CodingState,
  IMPACT_MODES,
  ImpactMode,
  OEE_COMPONENTS,
  OeeComponent,
  PHYSICAL_STATES,
  PHYSICAL_TYPES,
  PhysicalState,
  PhysicalType,
  RCA_STATES,
  RcaState,
  SCHEDULE_CLASSES,
  ScheduleClass,
  SOURCE_KINDS,
  SourceKind,
} from '../domain/events/event-classification';

/** `[start, end)` in seconds; null while the event is open (spec §3.3). Postgres computes it. */
export const DURATION_SECONDS_EXPRESSION =
  'CASE WHEN "end_time" IS NULL THEN NULL ELSE EXTRACT(EPOCH FROM ("end_time" - "start_time")) END';

@Entity('production_events')
@Check(
  'CHK_production_events_interval',
  '"end_time" IS NULL OR "end_time" > "start_time"',
)
@Check(
  'CHK_production_events_impact_fraction',
  '"impact_fraction" IS NULL OR ("impact_fraction" >= 0 AND "impact_fraction" <= 1)',
)
@Index('IDX_production_events_tenant_unit_start', [
  'tenantId',
  'unitId',
  'startTime',
])
@Index('IDX_production_events_tenant_asset_start', [
  'tenantId',
  'assetId',
  'startTime',
])
@Index('IDX_production_events_tenant_type_start', [
  'tenantId',
  'physicalType',
  'startTime',
])
// tenant-wide first page, newest first (plan 3.11: 158 ms → 1 ms at 50k events)
@Index('IDX_production_events_tenant_start', ['tenantId', 'startTime', 'id'])
@Index('IDX_production_events_tenant_occurrence', ['tenantId', 'occurrenceId'])
@Index('IDX_production_events_tenant_reason_start', [
  'tenantId',
  'reasonCodeId',
  'startTime',
])
@Index('IDX_production_events_open_by_unit', ['tenantId', 'unitId'], {
  where: '"end_time" IS NULL',
})
export class ProductionEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_id', type: 'varchar', length: 255, nullable: true })
  eventId: string;

  @Column({ name: 'plan_id', type: 'uuid', nullable: true })
  planId: string;

  @ManyToOne(() => ProductionPlan)
  @JoinColumn({ name: 'plan_id' })
  plan: ProductionPlan;

  @Column({ name: 'unit_id', type: 'uuid' })
  unitId: string;

  @ManyToOne(() => Unit)
  @JoinColumn({ name: 'unit_id' })
  unit: Unit;

  @Column({ name: 'asset_id', type: 'uuid', nullable: true })
  assetId: string;

  @ManyToOne(() => Asset)
  @JoinColumn({ name: 'asset_id' })
  asset: Asset;

  @Column({ name: 'impact_code_id', type: 'uuid', nullable: true })
  impactCodeId: string;

  @ManyToOne(() => ImpactCode)
  @JoinColumn({ name: 'impact_code_id' })
  impactCode: ImpactCode;

  @Column({ name: 'oee_code_id', type: 'uuid', nullable: true })
  oeeCodeId: string;

  @ManyToOne(() => OEECode)
  @JoinColumn({ name: 'oee_code_id' })
  oeeCode: OEECode;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'start_time', type: 'timestamptz' })
  startTime: Date;

  @Column({ name: 'end_time', type: 'timestamptz', nullable: true })
  endTime?: Date;

  @Column({ name: 'source', type: 'varchar', length: 50, nullable: true })
  source?: string; // Manual, Simulated PI, CMMS

  @Column({
    name: 'quantity',
    type: 'decimal',
    precision: 24,
    scale: 8,
    nullable: true,
  })
  quantity?: number;

  @Column({
    name: 'cost',
    type: 'decimal',
    precision: 24,
    scale: 8,
    nullable: true,
  })
  cost?: number;

  @Column({ name: 'status', type: 'varchar', length: 50, nullable: true })
  status?: string; // Open, Coded, RCA Required, Closed, Investigating, In Progress, Completed, Cancelled

  @Column({ name: 'rca_id', type: 'uuid', nullable: true })
  rcaId: string;

  @ManyToOne(() => RCA, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'rca_id' })
  rca: RCA;

  @Column({ name: 'event_type', type: 'varchar', length: 50, nullable: true })
  eventType?: string; // ProductionLoss, IOW, SOL, APM, FailureWO, ProductionOutput

  @Column({ name: 'parameter', type: 'varchar', length: 255, nullable: true })
  parameter?: string;

  @Column({
    name: 'value',
    type: 'decimal',
    precision: 15,
    scale: 4,
    nullable: true,
  })
  value?: number;

  @Column({
    name: 'limit_value',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  limit?: number;

  @Column({ name: 'limit_type', type: 'varchar', length: 10, nullable: true })
  limitType?: string; // High, Low

  @Column({ name: 'breach_duration', type: 'int', nullable: true })
  breachDuration?: number;

  @Column({ name: 'sol_type', type: 'varchar', length: 50, nullable: true })
  solType?: string; // Safety, Operational

  @Column({ name: 'apm_type', type: 'varchar', length: 100, nullable: true })
  apmType?: string;

  @Column({ name: 'severity', type: 'varchar', length: 50, nullable: true })
  severity?: string; // Low, Medium, High, Critical

  @Column({ name: 'recommended_action', type: 'text', nullable: true })
  recommendedAction?: string;

  @Column({
    name: 'work_order_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  workOrderId?: string;

  @Column({
    name: 'failure_mode',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  failureMode?: string;

  @Column({
    name: 'defective_quantity',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  defectiveQuantity?: number;

  @Column({ name: 'shift', type: 'varchar', length: 50, nullable: true })
  shift?: string;

  @Column({ name: 'crew', type: 'varchar', length: 100, nullable: true })
  crew?: string;

  @Column({ name: 'audit_trail', type: 'text', nullable: true })
  auditTrail?: string;

  @Column({
    name: 'loss_category',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  lossCategory?: string;

  @Column({
    name: 'operator_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  operatorName?: string;

  @Column({ name: 'reason_code_id', type: 'uuid', nullable: true })
  reasonCodeId?: string;

  @ManyToOne(() => ReasonCode)
  @JoinColumn({ name: 'reason_code_id' })
  reasonCode?: ReasonCode;

  @Column({
    name: 'duration',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  duration?: number;

  @Column({ name: 'tenant_id', type: 'varchar', length: 36, nullable: true })
  tenantId?: string;

  @Column({
    name: 'organization_id',
    type: 'varchar',
    length: 36,
    nullable: true,
  })
  organizationId?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  /** Optimistic concurrency for v2 (`ETag` / `If-Match`, 412 on stale). */
  @VersionColumn({ name: 'row_version', default: 1 })
  rowVersion: number;

  // --- Interval model and classifications (plan 1.1, spec §3.2/§3.3, DT11) ---

  @Column({
    name: 'duration_seconds',
    type: 'numeric',
    precision: 18,
    scale: 3,
    nullable: true,
    generatedType: 'STORED',
    asExpression: DURATION_SECONDS_EXPRESSION,
    insert: false,
    update: false,
  })
  durationSeconds?: number | null;

  @Column({
    name: 'physical_type',
    type: 'enum',
    enum: PHYSICAL_TYPES,
    enumName: 'production_event_physical_type',
    default: 'advisory',
  })
  physicalType: PhysicalType;

  @Column({
    name: 'schedule_class',
    type: 'enum',
    enum: SCHEDULE_CLASSES,
    enumName: 'production_event_schedule_class',
    default: 'unknown',
  })
  scheduleClass: ScheduleClass;

  @Column({
    name: 'oee_component',
    type: 'enum',
    enum: OEE_COMPONENTS,
    enumName: 'production_event_oee_component',
    default: 'none',
  })
  oeeComponent: OeeComponent;

  @Column({
    name: 'impact_mode',
    type: 'enum',
    enum: IMPACT_MODES,
    enumName: 'production_event_impact_mode',
    default: 'none',
  })
  impactMode: ImpactMode;

  /** 0..1 share of capacity lost when `impact_mode = fractional` */
  @Column({
    name: 'impact_fraction',
    type: 'numeric',
    precision: 9,
    scale: 8,
    nullable: true,
  })
  impactFraction?: number | null;

  @Column({
    name: 'physical_state',
    type: 'enum',
    enum: PHYSICAL_STATES,
    enumName: 'production_event_physical_state',
    default: 'open',
  })
  physicalState: PhysicalState;

  @Column({
    name: 'coding_state',
    type: 'enum',
    enum: CODING_STATES,
    enumName: 'production_event_coding_state',
    default: 'uncoded',
  })
  codingState: CodingState;

  @Column({
    name: 'rca_state',
    type: 'enum',
    enum: RCA_STATES,
    enumName: 'production_event_rca_state',
    default: 'none',
  })
  rcaState: RcaState;

  @Column({
    name: 'source_kind',
    type: 'enum',
    enum: SOURCE_KINDS,
    enumName: 'production_event_source_kind',
    default: 'manual',
  })
  sourceKind: SourceKind;

  @Column({ name: 'quantity_uom', type: 'varchar', length: 32, nullable: true })
  quantityUom?: string | null;

  /** Stable business id across revisions (1.2); equals `id` for rows created before revisions exist. */
  @Column({ name: 'canonical_id', type: 'uuid', nullable: true })
  canonicalId?: string | null;

  /** Pre-1.1 `duration` value, kept for audit (MIG §18.2 "mixed duration units"). */
  @Column({
    name: 'legacy_duration',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  legacyDuration?: number | null;

  /** Unit the legacy duration was assumed to be in ('min'), or null when unknown and flagged for review. */
  @Column({
    name: 'legacy_duration_unit_assumed',
    type: 'varchar',
    length: 8,
    nullable: true,
  })
  legacyDurationUnitAssumed?: string | null;

  /** Raw PI open-frame sentinel (9999-12-31) replaced by a null end (B6). */
  @Column({ name: 'legacy_end_sentinel', type: 'timestamptz', nullable: true })
  legacyEndSentinel?: Date | null;

  /** uuid copy of `tenant_id` kept in sync by trigger (expand step of the varchar → uuid change). */
  @Column({
    name: 'tenant_uuid',
    type: 'uuid',
    nullable: true,
    insert: false,
    update: false,
  })
  tenantUuid?: string | null;

  // --- Revisions and source ownership (plan 1.2, ING01/ING06) ---

  /** `event_revisions.revision` of the latest source revision; 0 when the source never spoke */
  @Column({ name: 'current_source_revision', type: 'int', default: 0 })
  currentSourceRevision: number;

  @Column({ name: 'current_coding_revision', type: 'int', default: 0 })
  currentCodingRevision: number;

  @Column({ name: 'retracted_at', type: 'timestamptz', nullable: true })
  retractedAt?: Date | null;

  /** identical source deliveries absorbed without a revision (ING01) */
  @Column({ name: 'duplicate_deliveries', type: 'int', default: 0 })
  duplicateDeliveries: number;

  /** field → `event_coding.revision` that overrode the source value */
  @Column({ name: 'user_overrides', type: 'jsonb', default: () => "'{}'" })
  userOverrides: Record<string, number>;

  /** where each code-driven classification came from (code rule, code default, user; plan 1.3) */
  @Column({ name: 'classification_basis', type: 'jsonb', nullable: true })
  classificationBasis?: ClassificationBasis | null;

  // --- Event operations (plan 1.4, DT09) ---

  /** physical stop occurrence (KPI06); split children share it. A trigger sets it to `id` when absent. */
  @Column({ name: 'occurrence_id', type: 'uuid' })
  occurrenceId: string;

  /** the event a merge replaced this one with; null for split parents (two children) */
  @Column({ name: 'superseded_by_event_id', type: 'uuid', nullable: true })
  supersededByEventId?: string | null;
}
