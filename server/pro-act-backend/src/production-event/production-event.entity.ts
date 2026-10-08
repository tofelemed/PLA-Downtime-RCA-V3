import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ProductionPlan } from '../production-plan/production-plan.entity';
import { Unit } from '../unit/unit.entity';
import { Asset } from '../asset/asset.entity';
import { ImpactCode } from '../impact-code/impact-code.entity';
import { OEECode } from '../oee-code/oee-code.entity';
import { RCA } from '../rca/rca.entity';
import { ReasonCode } from '../reason-code/reason-code.entity';

@Entity('production_events')
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
    precision: 10,
    scale: 2,
    nullable: true,
  })
  quantity?: number;

  @Column({
    name: 'cost',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  cost?: number;

  @Column({ name: 'status', type: 'varchar', length: 50, nullable: true })
  status?: string; // Open, Coded, RCA Required, Closed, Investigating, In Progress, Completed, Cancelled

  @Column({ name: 'rca_id', type: 'uuid', nullable: true })
  rcaId: string;

  @ManyToOne(() => RCA)
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
}
