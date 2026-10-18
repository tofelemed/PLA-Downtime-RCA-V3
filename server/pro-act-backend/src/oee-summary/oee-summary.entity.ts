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
import { Tenant } from '../tenant/tenant.entity';

@Entity('oee_summaries')
export class OEESummary {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId: string;
  @ManyToOne(() => ProductionPlan)
  @JoinColumn({ name: 'plan_id' })
  plan: ProductionPlan;

  @Column({
    name: 'availability',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  availability: number;

  @Column({
    name: 'performance',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  performance: number;

  @Column({
    name: 'quality',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  quality: number;

  @Column({
    name: 'oee',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  overallOEE: number;

  @Column({ name: 'period', type: 'varchar', length: 50, nullable: true })
  period: string;

  @Column({
    name: 'planned_production_time',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  plannedProductionTime?: number;

  @Column({
    name: 'actual_production_time',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  actualProductionTime?: number;

  @Column({
    name: 'downtime',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  downtime?: number;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId: string;
  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
