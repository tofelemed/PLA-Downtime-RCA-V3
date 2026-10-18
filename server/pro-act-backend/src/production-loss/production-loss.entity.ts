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
import { ImpactCode } from '../impact-code/impact-code.entity';
import { OEECode } from '../oee-code/oee-code.entity';
import { Tenant } from '../tenant/tenant.entity';

@Entity('production_losses')
export class ProductionLoss {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId: string;
  @ManyToOne(() => ProductionPlan)
  @JoinColumn({ name: 'plan_id' })
  plan: ProductionPlan;

  @Column({ name: 'period', type: 'varchar', length: 50, nullable: true })
  period: string;

  // Frontend Required Fields - Need to be added to database via migration
  @Column({
    name: 'actual',
    type: 'decimal',
    precision: 15,
    scale: 4,
    nullable: true,
  })
  actual?: number;

  @Column({
    name: 'short_range_plan',
    type: 'decimal',
    precision: 15,
    scale: 4,
    nullable: true,
  })
  shortRangePlan?: number;

  @Column({
    name: 'losses',
    type: 'decimal',
    precision: 15,
    scale: 4,
    nullable: true,
  })
  losses?: number;

  @Column({
    name: 'unaccounted_loss',
    type: 'decimal',
    precision: 15,
    scale: 4,
    nullable: true,
  })
  unaccountedLoss?: number;

  @Column({ name: 'action', type: 'varchar', length: 50, nullable: true })
  action?: string; // 'Reconcile' | 'RCA Required' | 'Closed'

  // Additional fields from database schema
  @Column({ name: 'loss_type', type: 'varchar', length: 100, nullable: true })
  lossType?: string;

  @Column({
    name: 'loss_category',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  lossCategory?: string;

  @Column({
    name: 'quantity',
    type: 'decimal',
    precision: 15,
    scale: 4,
    nullable: true,
  })
  quantity?: number;

  @Column({
    name: 'cost',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  cost?: number;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;
  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
