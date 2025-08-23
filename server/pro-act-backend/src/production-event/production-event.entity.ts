import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
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

  @Column({ type: 'varchar', length: 255 })
  eventId: string;

  @Column({ type: 'uuid', nullable: true })
  planId: string;

  @ManyToOne(() => ProductionPlan)
  @JoinColumn({ name: 'planId' })
  plan: ProductionPlan;

  @Column({ type: 'uuid' })
  unitId: string;

  @ManyToOne(() => Unit)
  @JoinColumn({ name: 'unitId' })
  unit: Unit;

  @Column({ type: 'uuid', nullable: true })
  assetId: string;

  @ManyToOne(() => Asset)
  @JoinColumn({ name: 'assetId' })
  asset: Asset;

  @Column({ type: 'uuid', nullable: true })
  impactCodeId: string;

  @ManyToOne(() => ImpactCode)
  @JoinColumn({ name: 'impactCodeId' })
  impactCode: ImpactCode;

  @Column({ type: 'uuid', nullable: true })
  oeeCodeId: string;

  @ManyToOne(() => OEECode)
  @JoinColumn({ name: 'oeeCodeId' })
  oeeCode: OEECode;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'datetime' })
  startTime: Date;

  @Column({ type: 'datetime', nullable: true })
  endTime: Date;

  @Column({ type: 'varchar', length: 50 })
  source: string; // Manual, Simulated PI, CMMS

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  cost: number;

  @Column({ type: 'varchar', length: 50 })
  status: string; // Open, Coded, RCA Required, Closed, Investigating, In Progress, Completed, Cancelled

  @Column({ type: 'uuid', nullable: true })
  rcaId: string;

  @ManyToOne(() => RCA)
  @JoinColumn({ name: 'rcaId' })
  rca: RCA;

  @Column({ type: 'varchar', length: 50 })
  eventType: string; // ProductionLoss, IOW, SOL, APM, FailureWO, ProductionOutput

  @Column({ type: 'varchar', length: 255, nullable: true })
  parameter: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  value: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  limit: number;

  @Column({ type: 'varchar', length: 10, nullable: true })
  limitType: string; // High, Low

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  breachDuration: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  solType: string; // Safety, Operational

  @Column({ type: 'varchar', length: 100, nullable: true })
  apmType: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  severity: string; // Low, Medium, High, Critical

  @Column({ type: 'text', nullable: true })
  recommendedAction: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  workOrderId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  failureMode: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  defectiveQuantity: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  shift: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  crew: string;

  @Column({ type: 'nvarchar', length: 'max', nullable: true })
  auditTrail: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  lossCategory: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  operatorName: string;

  @Column({ type: 'uuid', nullable: true })
  reasonCodeId: string;

  @ManyToOne(() => ReasonCode)
  @JoinColumn({ name: 'reasonCodeId' })
  reasonCode: ReasonCode;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  duration: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 