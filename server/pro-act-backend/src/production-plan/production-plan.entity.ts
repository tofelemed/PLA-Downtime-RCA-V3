import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('production_plans')
export class ProductionPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'plan_name', type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'unit_id', type: 'varchar', length: 36 })
  unitId: string;

  @Column({ name: 'product_id', type: 'varchar', length: 36, nullable: true })
  productId?: string;

  @Column({ name: 'tenant_id', type: 'varchar', length: 36, nullable: true })
  tenantId?: string;

  @Column({ name: 'organization_id', type: 'varchar', length: 36, nullable: true })
  organizationId?: string;

  @Column({ name: 'start_date', type: 'timestamptz' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'timestamptz' })
  endDate: Date;

  @Column({ name: 'target_quantity', type: 'decimal', precision: 15, scale: 4, nullable: true })
  plannedQuantity?: number;

  @Column({ name: 'actual_quantity', type: 'decimal', precision: 15, scale: 4, nullable: true })
  actualQuantity?: number;

  @Column({ name: 'status', type: 'varchar', length: 50, nullable: true })
  status?: string;

  @Column({ name: 'tolerance_limit', type: 'decimal', precision: 15, scale: 4, nullable: true })
  toleranceLimit?: number;

  @Column({ name: 'plan_basis', type: 'varchar', length: 255, nullable: true })
  planBasis?: string;

  @Column({ name: 'useful_production_time', type: 'text', nullable: true })
  usefulProductionTime?: string; // JSON string

  @Column({ name: 'recurrence', type: 'varchar', length: 100, nullable: true })
  recurrence?: string;

  @Column({ name: 'data_entry_frequency', type: 'varchar', length: 100, nullable: true })
  dataEntryFrequency?: string;

  @Column({ name: 'shift', type: 'varchar', length: 50, nullable: true })
  shift?: string;

  @Column({ name: 'crew', type: 'varchar', length: 100, nullable: true })
  crew?: string;

  @Column({ name: 'planner_notes', type: 'text', nullable: true })
  plannerNotes?: string;

  @Column({ name: 'comments', type: 'text', nullable: true })
  comments?: string; // JSON string

  @Column({ name: 'approval_status', type: 'varchar', length: 50, nullable: true })
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

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}