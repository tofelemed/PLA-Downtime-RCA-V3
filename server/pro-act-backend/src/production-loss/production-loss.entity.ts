import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ProductionPlan } from '../production-plan/production-plan.entity';
import { ImpactCode } from '../impact-code/impact-code.entity';
import { OEECode } from '../oee-code/oee-code.entity';
import { Tenant } from '../tenant/tenant.entity';

@Entity('production_losses')
export class ProductionLoss {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  planId: string;
  @ManyToOne(() => ProductionPlan)
  @JoinColumn({ name: 'planId' })
  plan: ProductionPlan;

  @Column({ type: 'varchar', length: 100 })
  period: string;

  @Column({ type: 'float' })
  actual: number;

  @Column({ type: 'float' })
  shortRangePlan: number;

  @Column({ type: 'float' })
  losses: number;

  @Column({ type: 'float' })
  unaccountedLoss: number;

  @Column({ type: 'varchar', length: 50 })
  action: string; // Reconcile, RCA Required, Closed

  @Column({ type: 'uuid' })
  tenantId: string;
  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 