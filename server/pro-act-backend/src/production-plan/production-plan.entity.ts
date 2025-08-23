import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Unit } from '../unit/unit.entity';
import { Product } from '../product/product.entity';
import { Tenant } from '../tenant/tenant.entity';

@Entity('production_plans')
export class ProductionPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'uuid' })
  unitId: string;

  @ManyToOne(() => Unit)
  @JoinColumn({ name: 'unitId' })
  unit: Unit;

  @Column({ type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  plannedQuantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  toleranceLimit: number;

  @Column({ type: 'datetime' })
  startDate: Date;

  @Column({ type: 'datetime' })
  endDate: Date;

  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 100, nullable: true })
  planBasis: string;

  @Column({ type: 'nvarchar', length: 'max', nullable: true })
  usefulProductionTime: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  recurrence: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  dataEntryFrequency: string;

  @Column({ type: 'varchar', length: 50 })
  status: string; // Planned, Active, Completed, Cancelled

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  actualQuantity: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  shift: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  crew: string;

  @Column({ type: 'text', nullable: true })
  plannerNotes: string;

  @Column({ type: 'nvarchar', length: 'max', nullable: true })
  comments: string;

  @Column({ type: 'varchar', length: 50 })
  approvalStatus: string; // Draft, Pending Review, Pending Approval, Approved, Rejected

  @Column({ type: 'varchar', length: 255, nullable: true })
  submittedBy: string;

  @Column({ type: 'datetime', nullable: true })
  submittedAt: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reviewedBy: string;

  @Column({ type: 'datetime', nullable: true })
  reviewedAt: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  approvedBy: string;

  @Column({ type: 'datetime', nullable: true })
  approvedAt: Date;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string;

  @Column({ type: 'nvarchar', length: 'max', nullable: true })
  customAttributes: string;

  @Column({ type: 'nvarchar', length: 'max', nullable: true })
  auditTrail: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 